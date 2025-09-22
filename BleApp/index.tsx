import React, { useState, useEffect } from 'react';
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

import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

// Create BleManager instance
const manager = new BleManager();

export default function BleScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState(new Map<string, Device>());
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [connectingDevice, setConnectingDevice] = useState<Device | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const startScan = () => {
    if (isScanning) {
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
    if (connectedDevice && connectedDevice.id === device.id) {
      disconnect(device);
    } else {
      connect(device);
    }
  };

  const connect = async (device: Device) => {
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

  const disconnect = (device: Device) => {
    if (device) {
      device.cancelConnection()
        .then(() => {
          console.log('Disconnected from ' + device.id);
          setConnectedDevice(null);
        })
        .catch(error => {
          console.log('Disconnect error', error);
        });
    }
  };

  useEffect(() => {
    handleAndroidPermissions();
    return () => {
      manager.stopDeviceScan();
    };
  }, []);

  const handleAndroidPermissions = () => {
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]).then(result => {
        if (result) {
          console.log('[handleAndroidPermissions] User accepts permissions', result);
        } else {
          console.error('[handleAndroidPermissions] User refuses permissions', result);
        }
      });
    } else if (Platform.OS === 'android' && Platform.Version >= 23) {
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).then(
        checkResult => {
          if (checkResult) {
            console.log('[handleAndroidPermissions] Permission is OK');
          } else {
            PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).then(
              requestResult => {
                if (requestResult) {
                  console.log('[handleAndroidPermissions] User accepts');
                } else {
                  console.error('[handleAndroidPermissions] User refuses');
                }
              },
            );
          }
        },
      );
    }
  };

  const renderItem = ({ item }: { item: Device }) => {
    const isDeviceConnected = connectedDevice && connectedDevice.id === item.id;
    const manufacturerData = item.manufacturerData
      ? Buffer.from(item.manufacturerData, 'base64').toString('hex')
      : null;

    return (
      <Pressable onPress={() => toggleConnect(item)}>
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
      
        <Text style={styles.title}>BLE Scanner</Text>
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
  row: { marginVertical: 10, padding: 15, backgroundColor: '#fff', borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41 },
  peripheralName: { fontSize: 16, fontWeight: 'bold' },
  rssi: { fontSize: 14, color: '#555' },
  connectionStatus: { fontSize: 14, fontWeight: 'bold', marginTop: 5 },
  connectingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10 },
  advContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  advHeader: { fontWeight: 'bold', marginBottom: 5 },
  advText: { fontSize: 12, color: '#333' },
});