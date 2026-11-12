import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Voice Command: listen and act on what the user says. Owner: The Revenant. */
export default function VoiceCommandScreen() {
  return (
    <PlaceholderScreen
      title="Voice Command"
      purpose="Listens, shows the words it heard, then does what you asked."
      phase="phase 4"
      owner="The Revenant"
      showMic={false}
      links={[{ label: 'Command History', icon: 'time', href: '/history' }]}
    />
  );
}
