import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Help: "What can I say?". Owner: The Revenant. */
export default function HelpScreen() {
  return (
    <PlaceholderScreen
      title="Help"
      purpose="Lists every voice command, grouped by screen, and can read the list aloud."
      phase="phase 5"
      owner="The Revenant"
      links={[{ label: 'Practice', icon: 'school', href: '/practice' }]}
    />
  );
}
