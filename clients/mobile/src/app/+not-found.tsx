import { Redirect } from 'expo-router';

/** Any path the router cannot match, which on a phone is almost always a deep
 *  link that outlived what it pointed at. Home rather than a dead end. */
export default function NotFound() {
  return <Redirect href="/" />;
}
