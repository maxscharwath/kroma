package expo.modules.lanbeacon

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.ServerSocket
import java.util.Collections
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

// Publishing "this television is waiting for an account" on the link, and
// hearing it from a telephone in the same room.
//
// Why the link at all, when the server already brokers this: a link-local
// multicast does not cross a router, so hearing one is proof of being in the
// room. The server can only compare the two devices' addresses, which it loses
// to NAT, to a routed house, and to a dual-stack one. What is published here
// carries a proof string the server will take instead.
//
// Unlike the Apple half, discovery here cannot read the text record: NsdManager
// only fills the attributes in on RESOLVE, so every hit is resolved and the
// resolves are serialised, exactly as the server-discovery module beside this
// one has to do (concurrent resolves fail with FAILURE_ALREADY_ACTIVE and a
// house with several televisions would lose all but the first).
private const val SERVICE_TYPE = "_kroma-tv._tcp."
private const val FOUND_EVENT = "lan-beacon:found"

class LanBeaconModule : Module() {
  private var nsd: NsdManager? = null
  private var registration: NsdManager.RegistrationListener? = null
  private var advertisedSocket: ServerSocket? = null
  private var browse: Browse? = null

  override fun definition() = ModuleDefinition {
    Name("LanBeacon")
    Events(FOUND_EVENT)

    Function("publish") { name: String, txt: Map<String, String> ->
      publish(name, txt)
    }

    Function("unpublish") { unpublish() }

    Function("startBrowse") {
      val manager = manager() ?: return@Function
      stopBrowse()
      browse = Browse(manager) { services -> sendEvent(FOUND_EVENT, mapOf("services" to services)) }
        .also { it.start() }
    }

    Function("stopBrowse") { stopBrowse() }

    OnDestroy {
      unpublish()
      stopBrowse()
    }
  }

  private fun manager(): NsdManager? {
    if (nsd == null) {
      nsd = appContext.reactContext?.getSystemService(Context.NSD_SERVICE) as? NsdManager
    }
    return nsd
  }

  private fun publish(name: String, txt: Map<String, String>) {
    val manager = manager() ?: return
    unpublish()

    // A DNS-SD advertisement needs a port, so one is taken and held. Nothing
    // ever connects to it: the record IS the message, and the grant it leads to
    // travels to the server over ordinary HTTP. Holding the socket is what
    // keeps the port ours for as long as the record names it.
    val socket = runCatching { ServerSocket(0) }.getOrNull() ?: return
    advertisedSocket = socket

    val info = NsdServiceInfo().apply {
      serviceName = name
      serviceType = SERVICE_TYPE
      port = socket.localPort
      for ((key, value) in txt) setAttribute(key, value)
    }
    val listener = object : NsdManager.RegistrationListener {
      override fun onServiceRegistered(info: NsdServiceInfo) = Unit
      override fun onRegistrationFailed(info: NsdServiceInfo, errorCode: Int) = Unit
      override fun onServiceUnregistered(info: NsdServiceInfo) = Unit
      override fun onUnregistrationFailed(info: NsdServiceInfo, errorCode: Int) = Unit
    }
    registration = listener
    // A network that refuses to multicast is a television that pairs through
    // the server, which is the path it was taking anyway.
    runCatching { manager.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener) }
      .onFailure { unpublish() }
  }

  private fun unpublish() {
    registration?.let { listener -> runCatching { nsd?.unregisterService(listener) } }
    registration = null
    runCatching { advertisedSocket?.close() }
    advertisedSocket = null
  }

  private fun stopBrowse() {
    browse?.stop()
    browse = null
  }
}

// One continuous browse. Holds what is currently audible and republishes the
// WHOLE view on every change, because a telephone that missed a departure would
// otherwise offer a television that has gone.
private class Browse(
  private val nsd: NsdManager,
  private val onFound: (List<Map<String, Any>>) -> Unit,
) {
  private val audible = Collections.synchronizedMap(linkedMapOf<String, Map<String, Any>>())
  private val pending = ArrayBlockingQueue<NsdServiceInfo>(64)
  private val running = AtomicBoolean(false)
  private var worker: Thread? = null

  private val listener = object : NsdManager.DiscoveryListener {
    override fun onServiceFound(service: NsdServiceInfo) {
      pending.offer(service)
    }

    override fun onServiceLost(service: NsdServiceInfo) {
      val name = service.serviceName ?: return
      if (audible.remove(name) != null) publish()
    }

    override fun onDiscoveryStarted(serviceType: String) = Unit
    override fun onDiscoveryStopped(serviceType: String) = Unit
    override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) = Unit
    override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) = Unit
  }

  fun start() {
    if (!running.compareAndSet(false, true)) return
    val started = runCatching {
      nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
    }.isSuccess
    if (!started) {
      // No multicast on this network: an empty view, and the caller falls back
      // to the server source it always had.
      running.set(false)
      onFound(emptyList())
      return
    }
    worker = Thread { drain() }.also { it.start() }
  }

  fun stop() {
    if (!running.compareAndSet(true, false)) return
    runCatching { nsd.stopServiceDiscovery(listener) }
    worker?.interrupt()
    worker = null
  }

  // One resolve at a time, for as long as the browse is up.
  private fun drain() {
    while (running.get()) {
      val service = runCatching { pending.poll(200, TimeUnit.MILLISECONDS) }.getOrNull() ?: continue
      val gate = ArrayBlockingQueue<Boolean>(1)
      @Suppress("DEPRECATION") // registerServiceInfoCallback is API 34+; this ships to older TVs.
      nsd.resolveService(
        service,
        object : NsdManager.ResolveListener {
          override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
            gate.offer(true)
          }

          override fun onServiceResolved(info: NsdServiceInfo) {
            record(info)
            gate.offer(true)
          }
        },
      )
      // Bounded: a resolve that never calls back must not strand the worker.
      runCatching { gate.poll(3, TimeUnit.SECONDS) }
    }
  }

  // A record with no attributes is not one of ours, whatever it is called.
  private fun record(info: NsdServiceInfo) {
    val name = info.serviceName ?: return
    val txt = info.attributes.orEmpty()
      .mapNotNull { (key, value) -> value?.let { key to String(it, Charsets.UTF_8) } }
      .toMap()
    if (txt.isEmpty()) return
    audible[name] = mapOf("name" to name, "txt" to txt)
    publish()
  }

  private fun publish() {
    if (running.get()) onFound(audible.values.toList())
  }
}
