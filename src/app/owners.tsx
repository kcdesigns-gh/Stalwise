import { Redirect } from 'expo-router';

// Owners and clients now live in the Clients tab.
export default function OwnersRedirect() {
  return <Redirect href="/clients" />;
}
