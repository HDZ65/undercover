import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * A typed utility hook for localStorage get/set operations.
 * Handles JSON serialization/deserialization and gracefully handles corrupted data.
 * Returns a stable setter reference that never changes.
 *
 * @template T - The type of the stored value
 * @param key - The localStorage key
 * @param initialValue - The initial value if localStorage is empty or corrupted
 * @returns A tuple of [storedValue, setValue]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return initialValue;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const keyRef = useRef(key);
  keyRef.current = key;

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(keyRef.current, JSON.stringify(valueToStore));
        return valueToStore;
      });
    } catch (error) {
      console.warn(`Error writing to localStorage key "${keyRef.current}":`, error);
    }
  }, []);

  // Sync state when key changes
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        setStoredValue(initialValue);
      } else {
        setStoredValue(JSON.parse(item) as T);
      }
    } catch (error) {
      console.warn(`Error syncing localStorage key "${key}":`, error);
      setStoredValue(initialValue);
    }
  }, [key, initialValue]);

  return [storedValue, setValue];
}
