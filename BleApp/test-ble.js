// Simple test to verify BLE functionality
const { BleManager } = require('react-native-ble-plx');

// The original code below is problematic.
// 1. It cannot be run directly with Node.js because `react-native-ble-plx`
//    requires the React Native environment to function.
// 2. The code runs automatically when the file is imported.
// 3. `process.exit(0)` will crash your React Native application.
//
// console.log('Testing BLE Manager...');
// const manager = new BleManager();
//
// console.log('BLE Manager created successfully!');
// console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(manager)));
//
// process.exit(0);

/**
 * Initializes a new BleManager instance.
 * This should be called from within a React component.
 */
export const initializeBleManager = () => {
    console.log('Initializing BLE Manager...');
    const manager = new BleManager();
    console.log('BLE Manager created successfully!');
    return manager;
};
