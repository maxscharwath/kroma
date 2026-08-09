import ExpoModulesCore
import Network

/**
 * Publishing "this television is waiting for an account" on the link, and
 * hearing it from a telephone in the same room.
 *
 * Why the link at all, when the server already brokers this: because a
 * link-local multicast does not cross a router, so hearing one is proof of
 * being in the room. The server can only compare the two devices' addresses,
 * which it loses to NAT, to a routed house, and to a dual-stack one where the
 * television arrives over IPv6 and the telephone over IPv4. What is published
 * here carries a proof string the server will take instead.
 *
 * The browse deliberately does NOT resolve. `NWBrowser` hands back the TXT
 * record in the result's metadata, and TXT is the entire payload: there is no
 * host to connect to and no port that means anything. The server-discovery
 * module beside this one has to resolve because it wants an address; this one
 * must not, because resolving would be a connection attempt per television for
 * nothing.
 *
 * Browsing at all requires `NSBonjourServices` to list `_kroma-tv._tcp` in
 * Info.plist, and publishing requires `NSLocalNetworkUsageDescription`. Both
 * are in app.json for the two apps that use this. Without them this stays
 * silent and says nothing about why, which is Apple's design, not ours.
 */
public class LanBeaconModule: Module {
  private let state = BeaconState()

  public func definition() -> ModuleDefinition {
    Name("LanBeacon")
    Events("lan-beacon:found")

    Function("publish") { (name: String, txt: [String: String]) in
      self.state.publish(name: name, txt: txt)
    }

    Function("unpublish") {
      self.state.unpublish()
    }

    Function("startBrowse") {
      self.state.startBrowse { services in
        self.sendEvent("lan-beacon:found", ["services": services])
      }
    }

    Function("stopBrowse") {
      self.state.stopBrowse()
    }

    OnDestroy {
      self.state.unpublish()
      self.state.stopBrowse()
    }
  }
}

// Everything with a lifetime, kept off the module so a reload cannot strand a
// listener still holding the port.
private final class BeaconState {
  private let queue = DispatchQueue(label: "tv.kroma.lan-beacon")
  private var listener: NWListener?
  private var browser: NWBrowser?

  private static let serviceType = "_kroma-tv._tcp"

  func publish(name: String, txt: [String: String]) {
    unpublish()
    var record = NWTXTRecord()
    for (key, value) in txt {
      record[key] = value
    }
    // A DNS-SD advertisement needs a port, so the listener takes an ephemeral
    // one. Nothing ever connects to it: the record IS the message, and the
    // grant it leads to travels to the server over ordinary HTTP.
    guard let listener = try? NWListener(using: .tcp) else { return }
    listener.service = NWListener.Service(name: name, type: Self.serviceType, txtRecord: record)
    // A connection here is nobody we know. Accepting and immediately cancelling
    // keeps the listener healthy; leaving them pending would stall it.
    listener.newConnectionHandler = { connection in connection.cancel() }
    listener.start(queue: queue)
    self.listener = listener
  }

  func unpublish() {
    listener?.cancel()
    listener = nil
  }

  func startBrowse(_ onFound: @escaping ([[String: Any]]) -> Void) {
    stopBrowse()
    let descriptor = NWBrowser.Descriptor.bonjour(type: Self.serviceType, domain: nil)
    // `includePeerToPeer` stays off: this is about the room's network, and AWDL
    // would let a device that is on no network of ours appear in the list.
    let browser = NWBrowser(for: descriptor, using: .tcp)

    browser.browseResultsChangedHandler = { results, _ in
      onFound(results.compactMap(Self.describe))
    }
    browser.stateUpdateHandler = { state in
      // No permission, or no Bonjour entry: an empty view rather than a hang.
      if case .failed = state { onFound([]) }
    }
    browser.start(queue: queue)
    self.browser = browser
  }

  func stopBrowse() {
    browser?.cancel()
    browser = nil
  }

  // A result with no text record is not one of ours, whatever it is called.
  private static func describe(_ result: NWBrowser.Result) -> [String: Any]? {
    guard case let .service(name, _, _, _) = result.endpoint,
          case let .bonjour(record) = result.metadata
    else { return nil }
    var txt: [String: String] = [:]
    for (key, value) in record.dictionary {
      txt[key] = value
    }
    if txt.isEmpty { return nil }
    return ["name": name, "txt": txt]
  }
}
