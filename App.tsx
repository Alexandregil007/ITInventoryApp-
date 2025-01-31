import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Modal,
  TouchableOpacity,
  StatusBar,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface HardwareItem {
  id: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  details?: string;
  monthlyCost: number;
}

type HardwareGroup = Record<string, HardwareItem[]>;
type SearchResultGroup = { key: string; items: HardwareItem[] };

const App = () => {
  const [hardwareGroups, setHardwareGroups] = useState<HardwareGroup>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentItem, setCurrentItem] = useState<HardwareItem>({
    id: '',
    name: '',
    brand: '',
    model: '',
    serialNumber: '',
    monthlyCost: 0
  });
  const [isEditing, setIsEditing] = useState(false);
  const [originalGroupKey, setOriginalGroupKey] = useState('');
  const [isMonthlyCostEditable, setIsMonthlyCostEditable] = useState(true);

  // Load inventory
  useEffect(() => {
    const loadInventory = async () => {
      try {
        const saved = await AsyncStorage.getItem('hardware');
        if (saved) setHardwareGroups(JSON.parse(saved) as HardwareGroup);
      } catch (error) {
        console.error('Error loading inventory:', error);
      }
    };
    loadInventory();
  }, []);

  // Check group existence and lock monthly cost
  useEffect(() => {
    const groupKey = getGroupKey(currentItem.name, currentItem.brand, currentItem.model);
    const existingGroup = hardwareGroups[groupKey];
    
    if (existingGroup?.length > 0) {
      setCurrentItem(prev => ({
        ...prev,
        monthlyCost: existingGroup[0].monthlyCost
      }));
      setIsMonthlyCostEditable(false);
    } else {
      setIsMonthlyCostEditable(true);
    }
  }, [currentItem.name, currentItem.brand, currentItem.model]);

  const saveInventory = async (groups: HardwareGroup) => {
    try {
      await AsyncStorage.setItem('hardware', JSON.stringify(groups));
    } catch (error) {
      console.error('Error saving inventory:', error);
    }
  };

  const getGroupKey = (name: string, brand: string, model: string): string => 
    `${name}|${brand}|${model}`;

  const resetForm = () => {
    setCurrentItem({
      id: '',
      name: '',
      brand: '',
      model: '',
      serialNumber: '',
      monthlyCost: 0
    });
    setOriginalGroupKey('');
    setIsEditing(false);
    setIsMonthlyCostEditable(true);
  };

  const handleSave = () => {
    if (!currentItem.name || !currentItem.brand || !currentItem.model || !currentItem.serialNumber) return;

    const newGroupKey = getGroupKey(currentItem.name, currentItem.brand, currentItem.model);
    const existingGroup = hardwareGroups[newGroupKey] || [];
    
    // Check for duplicate serial number
    const allItems = Object.values(hardwareGroups).flat();
    if (allItems.some(item => 
      item.serialNumber === currentItem.serialNumber && 
      (!isEditing || item.id !== currentItem.id)
    )) {
      alert('Serial number must be unique!');
      return;
    }

    const updatedGroups: HardwareGroup = { ...hardwareGroups };

    if (isEditing && originalGroupKey && originalGroupKey !== newGroupKey) {
      updatedGroups[originalGroupKey] = updatedGroups[originalGroupKey].filter(
        item => item.id !== currentItem.id
      );
      
      if (updatedGroups[originalGroupKey].length === 0) {
        delete updatedGroups[originalGroupKey];
      }
    }

    const newItem: HardwareItem = {
      ...currentItem,
      monthlyCost: existingGroup[0]?.monthlyCost || currentItem.monthlyCost,
      id: isEditing ? currentItem.id : Date.now().toString()
    };

    updatedGroups[newGroupKey] = [
      ...existingGroup.filter(item => item.id !== newItem.id),
      newItem
    ];

    setHardwareGroups(updatedGroups);
    saveInventory(updatedGroups);
    setIsModalVisible(false);
    resetForm();
  };

  const searchResults = (): SearchResultGroup[] => {
    const query = searchQuery.toLowerCase();
    return Object.entries(hardwareGroups)
      .map(([key, items]) => ({
        key,
        items: items.filter(item => 
          item.name.toLowerCase().includes(query) ||
          item.brand.toLowerCase().includes(query) ||
          item.model.toLowerCase().includes(query) ||
          item.serialNumber.toLowerCase().includes(query) ||
          (item.details?.toLowerCase().includes(query) ?? false)
        )
      }))
      .filter(group => group.items.length > 0);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.watermark}>App created by: Alexandre Gil</Text>
      <Text style={styles.title}>Hardware Inventory</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search hardware..."
        placeholderTextColor="#888"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          resetForm();
          setIsModalVisible(true);
        }}
      >
        <Text style={styles.addButtonText}>+ Add Hardware</Text>
      </TouchableOpacity>

      <FlatList
        data={searchResults()}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          const [name, brand, model] = item.key.split('|');
          const groupMonthlyCost = item.items[0]?.monthlyCost || 0;
          
          return (
            <View style={styles.groupContainer}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{name} - {brand} - {model}</Text>
                <View style={styles.groupMetadata}>
                  <Text style={styles.stock}>Stock: {item.items.length}</Text>
                  <Text style={styles.monthlyCost}>${groupMonthlyCost}/month</Text>
                </View>
              </View>
              
              <Text style={styles.serialsTitle}>Individual Items:</Text>
              {item.items.map((hardware: HardwareItem) => (
                <View key={hardware.id} style={styles.serialItem}>
                  <View style={styles.serialInfo}>
                    <Text style={styles.serialText}>{hardware.serialNumber}</Text>
                    {hardware.details && <Text style={styles.details}>{hardware.details}</Text>}
                  </View>
                  <View style={styles.itemActions}>
                    <Button
                      title="Edit"
                      color="#BB86FC"
                      onPress={() => {
                        setCurrentItem(hardware);
                        setOriginalGroupKey(getGroupKey(hardware.name, hardware.brand, hardware.model));
                        setIsEditing(true);
                        setIsModalVisible(true);
                      }}
                    />
                    <Button
                      title="Delete"
                      color="#CF6679"
                      onPress={() => {
                        const updated = { ...hardwareGroups };
                        const groupKey = getGroupKey(hardware.name, hardware.brand, hardware.model);
                        
                        updated[groupKey] = updated[groupKey].filter(i => i.id !== hardware.id);
                        if (updated[groupKey].length === 0) delete updated[groupKey];
                        
                        setHardwareGroups(updated);
                        saveInventory(updated);
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          );
        }}
      />

      <Modal visible={isModalVisible} animationType="slide">
        <ScrollView
          contentContainerStyle={styles.modal}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.modalTitle}>
            {isEditing ? 'Edit Hardware' : 'New Hardware'}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter hardware name"
              placeholderTextColor="#888"
              value={currentItem.name}
              onChangeText={text => setCurrentItem(prev => ({ ...prev, name: text }))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Brand *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter brand name"
              placeholderTextColor="#888"
              value={currentItem.brand}
              onChangeText={text => setCurrentItem(prev => ({ ...prev, brand: text }))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Model *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter model number"
              placeholderTextColor="#888"
              value={currentItem.model}
              onChangeText={text => setCurrentItem(prev => ({ ...prev, model: text }))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Serial Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter unique serial number"
              placeholderTextColor="#888"
              value={currentItem.serialNumber}
              onChangeText={text => setCurrentItem(prev => ({ ...prev, serialNumber: text }))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Monthly Cost *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter monthly cost"
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={currentItem.monthlyCost.toString()}
              onChangeText={text => {
                if (isMonthlyCostEditable) {
                  setCurrentItem(prev => ({ 
                    ...prev, 
                    monthlyCost: Number(text) || 0 
                  }));
                }
              }}
              editable={isMonthlyCostEditable}
            />
            {!isMonthlyCostEditable && (
              <Text style={styles.lockMessage}>
                Monthly cost locked to group value
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Details (optional)</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Enter additional details"
              placeholderTextColor="#888"
              multiline
              value={currentItem.details}
              onChangeText={text => setCurrentItem(prev => ({ ...prev, details: text }))}
            />
          </View>

          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              color="#666"
              onPress={() => {
                setIsModalVisible(false);
                resetForm();
              }}
            />
            <Button title="Save" color="#BB86FC" onPress={handleSave} />
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#121212',
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 40,
  },
  watermark: {
    position: 'absolute',
    top: 60,
    left: 20,
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 12,
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: '#1E1E1E',
    color: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#1E88E5',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  groupContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  groupTitle: {
    color: '#BB86FC',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 2,
  },
  groupMetadata: {
    alignItems: 'flex-end',
    flex: 1,
  },
  stock: {
    color: '#4CAF50',
    fontSize: 14,
  },
  monthlyCost: {
    color: '#BB86FC',
    fontSize: 12,
  },
  serialsTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  serialItem: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serialInfo: {
    flex: 1,
  },
  serialText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  details: {
    color: '#888888',
    fontSize: 12,
    marginTop: 5,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modal: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#121212',
    paddingTop: 50,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 25,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    color: '#BB86FC',
    fontSize: 14,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#1E1E1E',
    color: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 25,
    gap: 15,
  },
  lockMessage: {
    color: '#888',
    fontSize: 12,
    marginTop: 5,
  },
});

export default App;