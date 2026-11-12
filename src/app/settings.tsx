import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Settings: text size, contrast and voice. Owners: Kosisochukwu and The Revenant. */
export default function SettingsScreen() {
  return (
    <PlaceholderScreen
      title="Settings"
      purpose="Change text size, high contrast, spoken buttons, and voice speed and pitch."
      phase="phase 2"
      owner="Kosisochukwu and The Revenant"
      links={[
        { label: 'Emergency Contacts', icon: 'call', href: '/emergency-contacts' },
        { label: 'About', icon: 'information-circle', href: '/about' },
      ]}
    />
  );
}
