import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Find: find and read a printed sign with the camera. Owner: Kachi. */
export default function FindScreen() {
  return (
    <PlaceholderScreen
      title="Find"
      purpose='Say "Find Room B12", follow the spoken cues until the sign is centred, then hear it read back.'
      phase="phase 6"
      owner="Kachi"
      links={[{ label: 'Magnifier', icon: 'search', href: '/magnifier' }]}
    />
  );
}
