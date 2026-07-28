// The device picker as the PLAYER shows it.
//
// Same list as the app's bottom sheet, in the player's own shell - which is a
// plain <Modal>, because this screen is a native fullScreenModal and @gorhom's
// sheet renders behind it. See <PlayerPanel>.

import { CastDeviceList } from '#mobile/components/cast/CastDeviceList';
import { PlayerPanel } from '#mobile/player/PlayerPanel';

export function CastPanel({
  visible,
  onClose,
  onPick,
  offerLocal = false,
}: Readonly<{
  visible: boolean;
  onClose(): void;
  onPick(receiverId: string | null): void;
  offerLocal?: boolean;
}>) {
  return (
    <PlayerPanel visible={visible} onClose={onClose}>
      <CastDeviceList onPick={onPick} offerLocal={offerLocal} />
    </PlayerPanel>
  );
}
