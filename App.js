import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, SectionList, TouchableOpacity, SafeAreaView,
  StatusBar, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, 
  ScrollView, Image, Dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- 日曆中文化 ---
LocaleConfig.locales['zh'] = {
  monthNames: ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'],
  monthNamesShort: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
  dayNames: ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'],
  dayNamesShort: ['日','一','二','三','四','五','六'],
  today: '今天'
};
LocaleConfig.defaultLocale = 'zh';

const PERSIST_TASKS_KEY = 'worklog_tasks_v23';
const PERSIST_CATS_KEY = 'worklog_cats_v23';
const DEFAULT_CATEGORIES = ['工程部', '工務部', '委外廠商', '環境維護', '緊急維修'];

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRehydrated, setIsRehydrated] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [catEditModalVisible, setCatEditModalVisible] = useState(false); 
  const [tempCatName, setTempCatName] = useState(''); 
  const [targetCat, setTargetCat] = useState(''); 
  const [isAddingNew, setIsAddingNew] = useState(false);

  // --- 記錄連續點擊時間 ---
  const [lastTap, setLastTap] = useState(0); 

  const [previewImage, setPreviewImage] = useState(null); 
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ 
    task: '', category: '工程部', date: getTodayStr(), progress: 0, workers: '', image: null 
  });

  // --- 資料持久化 ---
  useEffect(() => {
    (async () => {
      try {
        const savedTasks = await AsyncStorage.getItem(PERSIST_TASKS_KEY);
        const savedCats = await AsyncStorage.getItem(PERSIST_CATS_KEY);
        if (savedTasks) setTasks(JSON.parse(savedTasks));
        if (savedCats) setCategories(JSON.parse(savedCats));
      } finally { setIsRehydrated(true); }
    })();
  }, []);

  useEffect(() => {
    if (isRehydrated) {
      AsyncStorage.setItem(PERSIST_TASKS_KEY, JSON.stringify(tasks));
      AsyncStorage.setItem(PERSIST_CATS_KEY, JSON.stringify(categories));
    }
  }, [tasks, categories, isRehydrated]);

  // --- 分類管理：雙擊刪除邏輯 (已取消震動) ---
  const handleDeleteCat = (catName) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 400; // 0.4 秒判定為雙擊

    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      if (categories.length <= 1) return Alert.alert("提示", "至少需保留一個分類");
      
      const newCats = categories.filter(c => c !== catName);
      const fallbackCat = newCats[0]; 
      
      setCategories(newCats);
      setTasks(prev => prev.map(t => t.category === catName ? { ...t, category: fallbackCat } : t));
      if (form.category === catName) setForm(prev => ({...prev, category: fallbackCat}));
      
      setLastTap(0);
    } else {
      setLastTap(now);
    }
  };

  const handleLongPressCategory = (catName) => {
    setIsAddingNew(false);
    setTargetCat(catName);
    setTempCatName(catName);
    setCatEditModalVisible(true);
  };

  const handleSaveCategory = () => {
    const name = tempCatName.trim();
    if (!name) return;
    if (categories.includes(name) && name !== targetCat) return Alert.alert("提示", "分類名稱重複");

    if (isAddingNew) {
      setCategories([...categories, name]);
      setForm({...form, category: name});
    } else {
      setCategories(categories.map(c => c === targetCat ? name : c));
      setTasks(tasks.map(t => t.category === targetCat ? { ...t, category: name } : t));
      if (form.category === targetCat) setForm({...form, category: name});
    }
    setCatEditModalVisible(false);
    setTempCatName('');
  };

  // --- 任務操作 ---
  const openModal = (item = null) => {
    if (item) {
      setIsEditMode(true);
      setEditingId(item.id);
      setForm({ ...item });
    } else {
      setIsEditMode(false);
      setForm({ task: '', category: categories[0], date: getTodayStr(), progress: 0, workers: '', image: null });
    }
    setModalVisible(true);
  };

  const handleSaveTask = () => {
    if (!form.task.trim()) return Alert.alert("提示", "請輸入項目名稱");
    if (isEditMode) setTasks(tasks.map(t => t.id === editingId ? { ...form } : t));
    else setTasks([{ ...form, id: Date.now().toString() }, ...tasks]);
    setModalVisible(false);
  };

  const duplicateTask = (item) => {
    setTasks([{ ...item, id: Date.now().toString(), date: getTodayStr(), task: `${item.task} (複製)` }, ...tasks]);
    Alert.alert("成功", "已複製項目");
  };

  const deleteTask = (id) => {
    Alert.alert("確認刪除", "確定刪除這筆紀錄？",);
  };

  const pickImage = async (useCamera = false) => {
    const perm = useCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("權限錯誤", "需要授權");
    const res = useCamera ? await ImagePicker.launchCameraAsync({ quality: 0.7 }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!res.canceled) setForm({ ...form, image: res.assets[0].uri });
  };

  const handlePrint = async () => {
    const html = `<html><body style="padding:20px; font-family:sans-serif;"><h1>水灣碧潭工程週誌</h1><table border="1" style="width:100%; border-collapse:collapse;">${filtered.map(t => `<tr><td>${t.date}</td><td>${t.category}</td><td>${t.task}</td><td>${t.progress}%</td></tr>`).join('')}</table></body></html>`;
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  const filtered = useMemo(() => tasks.filter(t => 
    t.task.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  ), [tasks, searchQuery]);
  
  const sections = useMemo(() => [
    { title: '🛠️ 委外維修', data: filtered.filter(t => t.progress < 100 && t.category === '委外廠商') },
    { title: '⏳ 進行中', data: filtered.filter(t => t.progress < 100 && t.category !== '委外廠商') },
    { title: '✅ 已完成', data: filtered.filter(t => t.progress === 100) },
  ], [filtered]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>水灣碧潭工程週誌</Text>
        <View style={styles.searchRow}>
          <TextInput style={styles.searchBar} placeholder="🔍 搜尋項目..." value={searchQuery} onChangeText={setSearchQuery} />
          <TouchableOpacity onPress={handlePrint} style={styles.pdfBtn}><MaterialCommunityIcons name="file-pdf-box" size={32} color="white" /></TouchableOpacity>
        </View>
      </View>

      <SectionList
        sections={sections} keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { title, data } }) => data.length > 0 ? (
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text></View>
        ) : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{flexDirection:'row', alignItems:'center', flex:1}}><Text style={styles.tag}>{item.category}</Text><Text style={styles.dateTag}>{item.date}</Text></View>
              <Text style={[styles.progressText, { color: item.progress === 100 ? '#4CAF50' : '#1A237E' }]}>{item.progress}%</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={{ flex: 1 }}><Text style={styles.taskTitle}>{item.task}</Text><Text style={styles.workerText}>👷 {item.workers || '內部人員'}</Text></View>
              {item.image && (<TouchableOpacity onPress={() => setPreviewImage(item.image)}><Image source={{ uri: item.image }} style={styles.cardThumb} /></TouchableOpacity>)}
            </View>
            <View style={styles.progressContainer}><View style={[styles.progressBar, { width: `${item.progress}%`, backgroundColor: item.progress === 100 ? '#4CAF50' : '#1A237E' }]} /></View>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setTasks(tasks.map(t => t.id === item.id ? {...t, progress: 100} : t))}><MaterialCommunityIcons name="check-circle" size={16} color="#4CAF50" /><Text style={styles.actionBtnText}>完工</Text></TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => duplicateTask(item)}><MaterialCommunityIcons name="content-copy" size={14} color="#607D8B" /><Text style={styles.actionBtnText}>複製</Text></TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openModal(item)}><MaterialCommunityIcons name="pencil-outline" size={16} color="#2196F3" /><Text style={styles.actionBtnText}>編輯</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, {borderRightWidth:0}]} onPress={() => deleteTask(item.id)}><MaterialCommunityIcons name="trash-can-outline" size={16} color="#F44336" /><Text style={styles.actionBtnText}>刪除</Text></TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* 工作紀錄 Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{isEditMode ? '🔧 修改工作紀錄' : '📝 新增工作紀錄'}</Text>
              
              <Text style={styles.label}>📸 工程照片</Text>
              <View style={{flexDirection:'row', alignItems:'center', marginBottom:15}}>
                <TouchableOpacity style={styles.imgBox} onPress={() => pickImage(true)}>
                  {form.image ? <Image source={{ uri: form.image }} style={{width:'100%', height:'100%'}} /> : <MaterialCommunityIcons name="camera" size={30} color="#999" />}
                </TouchableOpacity>
                <TouchableOpacity style={styles.imgTextBtn} onPress={() => pickImage(false)}><Text style={{color:'#1A237E', fontWeight:'bold'}}>相簿選取</Text></TouchableOpacity>
              </View>

              <Text style={styles.label}>項目名稱</Text>
              <TextInput style={styles.input} value={form.task} onChangeText={t => setForm({...form, task: t})} />

              <Text style={[styles.label, {marginTop:15}]}>分類 (單擊選取 / 長按修改 / 連按二下刪除)</Text>
              <View style={styles.catGroup}>
                {categories.map((cat, idx) => (
                  <View key={`${cat}-${idx}`} style={[styles.catChip, form.category === cat && styles.catChipActive]}>
                    <TouchableOpacity 
                      style={styles.catChipMain}
                      onPress={() => setForm({...form, category: cat})}
                      onLongPress={() => handleLongPressCategory(cat)}
                    >
                      <Text style={{color: form.category === cat ? 'white' : '#666', fontSize: 12}}>{cat}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.catChipDel} onPress={() => handleDeleteCat(cat)}>
                      <MaterialCommunityIcons name="delete-outline" size={16} color={form.category === cat ? 'white' : '#F44336'} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addCatBtn} onPress={() => {setIsAddingNew(true); setTempCatName(''); setCatEditModalVisible(true);}}>
                   <Text style={{color: '#2196F3', fontSize: 12, fontWeight: 'bold'}}>+ 新增分類</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>施工人員</Text>
              <TextInput style={styles.input} value={form.workers} onChangeText={t => setForm({...form, workers: t})} />
              
              <View style={{marginTop: 15, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#EEE'}}>
                <Calendar onDayPress={d => setForm({...form, date: d.dateString})} markedDates={{[form.date]: {selected: true, selectedColor: '#1A237E'}}} />
              </View>

              <Text style={styles.label}>進度: {form.progress}%</Text>
              <View style={styles.progressBtnRow}>
                {[0, 25, 50, 75, 100].map(p => (
                  <TouchableOpacity key={p} style={[styles.pBtn, form.progress === p && styles.catBtnActive]} onPress={() => setForm({...form, progress: p})}><Text style={{color: form.progress === p ? 'white' : '#666', fontSize: 12}}>{p}%</Text></TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}><Text style={{color:'#666'}}>取消</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTask}><Text style={{color:'white', fontWeight:'bold'}}>儲存紀錄</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 分類編輯視窗 */}
      <Modal visible={catEditModalVisible} transparent animationType="fade">
        <View style={styles.catModalOverlay}>
          <View style={styles.catModalContent}>
            <Text style={styles.modalTitle}>{isAddingNew ? "🏷️ 新增分類" : "🔧 修改名稱"}</Text>
            <TextInput style={[styles.input, {marginVertical: 15}]} value={tempCatName} onChangeText={setTempCatName} autoFocus />
            <View style={{flexDirection:'row'}}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCatEditModalVisible(false)}><Text>取消</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCategory}><Text style={{color:'white', fontWeight:'bold'}}>確定</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={() => openModal()}><MaterialCommunityIcons name="plus" size={35} color="white" /></TouchableOpacity>

      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.closePreview} onPress={() => setPreviewImage(null)}><MaterialCommunityIcons name="close-circle" size={40} color="white" /></TouchableOpacity>
          <Image source={{ uri: previewImage }} style={styles.fullImage} resizeMode="contain" />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  header: { padding: 16, backgroundColor: '#1A237E', paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 15 },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchBar: { flex: 1, backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 15, height: 42 },
  pdfBtn: { marginLeft: 10 },
  sectionHeader: { padding: 10, backgroundColor: '#E8EAF6', marginTop: 10 },
  sectionTitle: { fontWeight: 'bold', color: '#1A237E', fontSize: 13 },
  card: { backgroundColor: 'white', marginHorizontal: 12, marginTop: 12, borderRadius: 15, overflow: 'hidden', elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, paddingBottom: 5 },
  tag: { backgroundColor: '#E1F5FE', color: '#0288D1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, fontSize: 11, fontWeight: 'bold' },
  dateTag: { fontSize: 12, color: '#999', marginLeft: 8 },
  progressText: { fontWeight: 'bold' },
  cardBody: { flexDirection: 'row', padding: 15, paddingTop: 5 },
  taskTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  workerText: { fontSize: 13, color: '#666' },
  cardThumb: { width: 60, height: 60, borderRadius: 8, marginLeft: 10 },
  progressContainer: { height: 4, backgroundColor: '#EEE' },
  progressBar: { height: '100%' },
  actionRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRightWidth: 1, borderRightColor: '#F0F0F0' },
  actionBtnText: { fontSize: 12, marginLeft: 5, color: '#555' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#1A237E' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#444', marginBottom: 8, marginTop: 5 },
  input: { backgroundColor: '#F5F5F5', borderRadius: 10, padding: 12, fontSize: 14 },
  imgBox: { width: 80, height: 80, backgroundColor: '#F5F5F5', borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#DDD' },
  imgTextBtn: { marginLeft: 15, padding: 10, backgroundColor: '#E8EAF6', borderRadius: 8 },
  catGroup: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  catChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 20, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#EEE', overflow: 'hidden' },
  catChipActive: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
  catChipMain: { paddingHorizontal: 12, paddingVertical: 6 },
  catChipDel: { paddingHorizontal: 8, paddingVertical: 6, borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.1)' },
  addCatBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#2196F3', marginBottom: 8 },
  progressBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  pBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: '#F5F5F5', marginHorizontal: 2, borderRadius: 5 },
  catBtnActive: { backgroundColor: '#1A237E' },
  modalActionRow: { flexDirection: 'row', marginTop: 25, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center' },
  saveBtn: { flex: 2, padding: 15, backgroundColor: '#1A237E', borderRadius: 10, alignItems: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 65, height: 65, borderRadius: 33, backgroundColor: '#1A237E', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  catModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  catModalContent: { width: '80%', backgroundColor: 'white', borderRadius: 20, padding: 20 },
  previewOverlay: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '80%' },
  closePreview: { position: 'absolute', top: 50, right: 20, zIndex: 10 }
});
