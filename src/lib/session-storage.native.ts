// iPhone and Android: keep the login in an on-device SQLite-backed localStorage.
import 'expo-sqlite/localStorage/install';

export const sessionStorage: Storage = localStorage;
