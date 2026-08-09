# Signing a television in

Three roads, and a television takes whichever ones its platform allows. They all
end in the same place: the server holds a pending request until a signed-in
account approves it, then hands the waiting device an ordinary session that
shows up in the device list and revokes like any other.

| road | how the human points at the television | works from |
| --- | --- | --- |
| Quick Connect | reads four digits off the screen, types them | anywhere |
| nearby handoff, server-brokered | taps a row in a list | the same network, as the server perceives it |
| nearby handoff, heard on the link | taps a row in a list | the same link, provably |

Quick Connect is the floor. It asks a human to carry four digits between two
screens, which is slow and is exactly why it works everywhere: across subnets,
over a tunnel, from a phone on cellular, on a television that cannot do anything
else. It is never removed.

## What "the same network" means

The handoff lists a television only to a caller the server can place beside it.
The server is a rendezvous, not a member of the network it pairs: a television
and a telephone in one room pair through a server in another country, because
the only pair of addresses compared is theirs.

`same_network` (`server/crates/kroma-engine/src/services/pairing/handoff.rs`)
answers by how the two arrived:

- **private IPv4** (the server is on their network, seeing them directly): same
  `/24`. One home spans `.20` on ethernet and `.50` on wifi.
- **public IPv4** (the server is elsewhere, seeing them through their NAT): the
  very same address. A household leaves through one, and a `/24` across the open
  internet would span strangers.
- **IPv6**, either way: same `/64`. That is one prefix delegation, which is one
  LAN.

Three cases this cannot settle, all of which fall back to Quick Connect:

1. a home routed across several subnets;
2. a dual-stack home where the television arrives over IPv6 and the telephone
   over IPv4;
3. carrier-grade NAT, where strangers share one public address and can therefore
   see each other's beacons.

And one it cannot even see, which is why it is configuration rather than a
limit: a reverse proxy the server has not been told about. Its requests arrive
from its own address, the forwarding headers are discarded, and every client
looks like that one address, so the rule answers yes for every pair. Name it in
`KROMA_TRUSTED_PROXIES` (see [server/README.md](../server/README.md)); a proxy
on the same host is loopback and needs nothing. Note that a beacon heard on the
link is unaffected either way, since it never asks the server where anyone is.

## What hearing it on the link adds

A link-local multicast does not cross a router, so hearing one is being in the
room. A television that can publish `_kroma-tv._tcp` puts a `proof` in the text
record, and `grant` accepts that **or** the address agreement above. All three
cases fall away for the shells that can publish and browse.

The proof is readable by anyone on the link. That is the trust boundary on
purpose: "anyone in the room" is what the feature means. Nothing about the
granting account travels in the record, and a stranger who somehow obtained a
proof can only push *their own* account onto a television, never take one.

## What each shell can do

| shell | publishes | browses | via |
| --- | --- | --- | --- |
| tv-native (Apple TV, Android TV) | yes | — | `@kroma/lan-beacon` |
| mobile (iOS, Android) | — | yes | `@kroma/lan-beacon` |
| web, tv-web, desktop | — | — | server source only |
| tizen, webos | — | — | server source only |

Discovery is a port, not a platform check: `TvDiscoverySource` in
`packages/core/src/handoff/sources.ts`. Anything that produces rows implements
it, and `watchNearbyTvs` merges them by handle, keeping the heard copy of a
television found twice because that is the one carrying the proof.
`LanDiscoveryBridge` is the narrower shape the DNS-SD family shares, so Apple's
`NWListener`/`NWBrowser` and Android's `NsdManager` share one source rather than
writing it twice.

## Why Tizen and webOS stop at the server

Not because it is impossible. Because it costs more than it buys.

A sandboxed television web app cannot bind a socket or publish a DNS-SD record,
so the only route is the vendor's own multiscreen stack: Samsung's Smart View /
MSF, or LG's Connect SDK. Both would mean a **telephone-side** integration per
vendor, a discovery mechanism neither shares with the other, and a protocol
implementation for each.

Weighed against that, what it would buy is the three cases above, on two
platforms, where the common case already works and Quick Connect already covers
the rest. And Samsung's own Smart View documentation still describes device
support through 2017 models, which is not a stack to build a sign-in path on
without a television in hand to test against.

If it is ever worth revisiting, the shape is already there: Samsung's and LG's
stacks are launch-an-app-and-open-a-channel, not DNS-SD, so they would implement
`TvDiscoverySource` directly rather than `LanDiscoveryBridge`. That is precisely
why the port is the abstraction and the bridge is not.
