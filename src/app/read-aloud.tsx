import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Read Aloud: type or paste text and hear it. Owner: Kosisochukwu. */
export default function ReadAloudScreen() {
  return (
    <PlaceholderScreen
      title="Read Aloud"
      purpose="Type or paste text and hear it read aloud, with pause, stop, replay and speed."
      phase="phases 2 and 3"
      owner="Kosisochukwu"
      links={[{ label: 'Saved Texts', icon: 'bookmark', href: '/saved-texts' }]}
    />
  );
}
