import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  Platform,
  View,
  PermissionsAndroid,
  Button,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';

import { BleManager, Device, State } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

export default function BleScreen() {
  // Use useMemo to ensure the BleManager instance is stable across re-renders
  const manager = useMemo(() => new BleManager(), []);
  const [bleState, setBleState] = useState<State>(State.Unknown);
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState(new Map<string, Device>());
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [connectingDevice, setConnectingDevice] = useState<Device | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const startScan = () => {
    if (isScanning || bleState !== State.PoweredOn) {
      console.warn(`Cannot scan, Bluetooth is ${bleState}.`);
      return;
    }
    // Reset the peripherals map before starting a new scan
    setPeripherals(new Map());
    setIsScanning(true);

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error(error);
        return;
      }
      if (device) {
        // Use a map to prevent duplicate entries
        setPeripherals(prev => {
          const newMap = new Map(prev);
          newMap.set(device.id, device);
          return newMap;
        });
      }
    });
    console.log('Scan started');

    // Stop scanning after 5 seconds
    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
      console.log('Scan stopped automatically');
    }, 5000);
  };

  const toggleConnect = (device: Device) => {
    if (isConnecting) {
      return;
    }
    if (connectedDevice?.id === device.id) {
      disconnect(device);
    } else {
      connect(device);
    }
  };

  const connect = async (device: Device) => {
    if (isScanning) {
      manager.stopDeviceScan();
      setIsScanning(false);
      console.log('Scan stopped to connect.');
    }
    setIsConnecting(true);
    setConnectingDevice(device);
    try {
      const connected = await device.connect();
      console.log('Connected to ' + connected.id);
      setConnectedDevice(connected);
    } catch (error) {
      console.log('Connection error', error);
    } finally {
      setIsConnecting(false);
      setConnectingDevice(null);
    }
  };

  const disconnect = async (device: Device) => {
    if (!device) return;
    try {
      await device.cancelConnection();
      console.log('Disconnected from ' + device.id);
      setConnectedDevice(null);
    } catch (error) {
      console.log('Disconnect error', error);
    }
  };

  // This effect tracks the Bluetooth state and requests permissions
  useEffect(() => {
    const subscription = manager.onStateChange((state) => {
      setBleState(state);
      if (state === State.PoweredOn) {
        handleAndroidPermissions();
      }
    }, true);

    return () => {
      subscription.remove();
      manager.stopDeviceScan();
      manager.destroy();
    };
  }, [manager]);

  const handleAndroidPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) { // Android 12+
        const permissions = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);

        if (
          permissions[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          permissions[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          console.log('[handleAndroidPermissions] All permissions granted');
        } else {
          console.warn('[handleAndroidPermissions] One or more permissions denied');
        }
      } else if (Platform.Version >= 23) { // Android 6-11
        const checkResult = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (checkResult) {
          console.log('[handleAndroidPermissions] Location permission is OK');
        } else {
          const requestResult = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
          if (requestResult === PermissionsAndroid.RESULTS.GRANTED) {
            console.log('[handleAndroidPermissions] User accepts location permission');
          } else {
            console.warn('[handleAndroidPermissions] User refuses location permission');
          }
        }
      }
    }
  };

  if (bleState !== State.PoweredOn) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <Text style={styles.title}>Bluetooth is {bleState}</Text>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: Device }) => {
    const isDeviceConnected = connectedDevice && connectedDevice.id === item.id;
    const manufacturerData = item.manufacturerData
      ? Buffer.from(item.manufacturerData, 'base64').toString('hex')
      : null;

    return (
      <Pressable onPress={() => toggleConnect(item)} disabled={isConnecting}>
        <View style={styles.row}>
          <Text style={styles.peripheralName}>
            {item.name || 'NO NAME'} ({item.id})
          </Text>
          <Text style={styles.rssi}>RSSI: {item.rssi}</Text>
          <Text
            style={[
              styles.connectionStatus,
              { color: isDeviceConnected ? 'green' : 'red' },
            ]}>
            {isDeviceConnected ? 'Connected' : 'Tap to Connect'}
          </Text>
          <View style={styles.advContainer}>
            <Text style={styles.advHeader}>Advertisement Data:</Text>
            <Text style={styles.advText}>Local Name: {item.localName || 'N/A'}</Text>
            <Text style={styles.advText}>
              Service UUIDs: {item.serviceUUIDs?.join(', ') || 'N/A'}
            </Text>
            {manufacturerData && (
              <Text style={styles.advText}>
                Manufacturer Data: {manufacturerData}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>React Native BLE Scanner</Text>
        <Button
          title={isScanning ? 'Scanning...' : 'Scan BLE Devices'}
          onPress={startScan}
          disabled={isScanning}
        />
      </View>
      {isConnecting && (
        <View style={styles.connectingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Connecting to {connectingDevice?.name || 'device'}...</Text>
        </View>
      )}
      <FlatList
        data={Array.from(peripherals.values())}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  listContainer: { paddingHorizontal: 10 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  row: { marginVertical: 10, padding: 15, backgroundColor: '#fff', borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41 },
  peripheralName: { fontSize: 16, fontWeight: 'bold' },
  rssi: { fontSize: 14, color: '#555' },
  connectionStatus: { fontSize: 14, fontWeight: 'bold', marginTop: 5 },
  connectingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10 },
  advContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  advHeader: { fontWeight: 'bold', marginBottom: 5 },
  advText: { fontSize: 12, color: '#333' },
});
