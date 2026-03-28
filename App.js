import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, SectionList, TouchableOpacity, SafeAreaView,
  StatusBar, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Calendar, LocaleConfig } from 'react-native-calendars';

// --- 日曆中文化配置 ---
LocaleConfig.locales['zh'] = {
  monthNames: ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'],
  monthNamesShort: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
  dayNames: ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'],
  dayNamesShort: ['日','一','二','三','四','五','六'],
  today: '今天'
};
LocaleConfig.defaultLocale = 'zh';

const PERSIST_TASKS_KEY = 'worklog_tasks_v11';
const PERSIST_CATS_KEY = 'worklog_cats_v11';
const DEFAULT_CATEGORIES = ['工程部', '工務部', '委外廠商', '環境維護', '緊急維修'];

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRehydrated, setIsRehydrated] = useState(false);
  
  // 控制兩個 Modal 的顯示
  const [modalVisible, setModalVisible] = useState(false);
  const [catManagerVisible, setCatManagerVisible] = useState(false);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ 
    task: '', status: '', category: '工程部', date: getTodayStr(), progress: 0, workers: '' 
  });

  // --- 初始化載入 ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedTasks = await AsyncStorage.getItem(PERSIST_TASKS_KEY);
        const savedCats = await AsyncStorage.getItem(PERSIST_CATS_KEY);
        if (savedTasks) setTasks(JSON.parse(savedTasks));
        if (savedCats) setCategories(JSON.parse(savedCats));
      } finally { setIsRehydrated(true); }
    };
    loadData();
  }, []);

  // --- 持久化儲存 ---
  useEffect(() => {
    if (isRehydrated) {
      AsyncStorage.setItem(PERSIST_TASKS_KEY, JSON.stringify(tasks));
      AsyncStorage.setItem(PERSIST_CATS_KEY, JSON.stringify(categories));
    }
  }, [tasks, categories, isRehydrated]);

  // --- 分類管理邏輯 ---
  const addCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    if (categories.includes(name)) return Alert.alert("提示", "此分類已存在");
    setCategories([...categories, name]);
    setNewCatName('');
  };

  const deleteCategory = (name) => {
    const performDelete = () => {
      const updated = categories.filter(c => c !== name);
      setCategories(updated);
      if (form.category === name) setForm({ ...form, category: updated[0] || '' });
    };

    if (Platform.OS === 'web') {
      if (confirm(`確定要刪除「${name}」嗎？`)) performDelete();
    } else {
      Alert.alert("刪除分類", `確定要刪除「${name}」嗎？`, [
        { text: "取消", style: "cancel" },
        { text: "刪除", style: "destructive", onPress: performDelete }
      ]);
    }
  };

  // --- 任務操作 ---
  const openModal = (item = null) => {
    if (item) {
      setIsEditMode(true);
      setEditingId(item.id);
      setForm({ ...item });
    } else {
      setIsEditMode(false);
      setForm({ task: '', status: '', category: categories[0] || '', date: getTodayStr(), progress: 0, workers: '' });
    }
    setModalVisible(true);
  };

  const handleSaveTask = () => {
    if (!form.task.trim()) return Alert.alert("提示", "請輸入項目名稱");
    if (isEditMode) setTasks(tasks.map(t => t.id === editingId ? { ...form } : t));
    else setTasks([{ ...form, id: Date.now().toString() }, ...tasks]);
    setModalVisible(false);
  };

  // --- 資料篩選 ---
  const filtered = useMemo(() => tasks.filter(t => 
    t.task.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  ), [tasks, searchQuery]);
  
  const sections = useMemo(() => [
    { title: '🛠️ 委外維修', data: filtered.filter(t => t.progress < 100 && t.category === '委外廠商') },
    { title: '⏳ 進行中', data: filtered.filter(t => t.progress < 100 && t.category !== '委外廠商') },
    { title: '✅ 已完成', data: filtered.filter(t => t.progress === 100) },
  ], [filtered]);

  const handlePrint = async () => {
    const renderRows = (data) => data.map(t => `<tr><td>${t.date}</td><td>${t.category}</td><td><b>${t.task}</b></td><td>${t.status || '-'}</td><td>${t.workers || '-'}</td><td>${t.progress}%</td></tr>`).join('');
    const html = `<html><head><style>body{padding:20px;font-family:sans-serif;}table{width:100%;border-collapse:collapse;margin-bottom:20px;}th,td{border:1px solid #ccc;padding:8px;font-size:11px;}th{background:#f2f2f2;}</style></head><body><h1>水灣碧潭工程週誌</h1>${sections.map(s => s.data.length > 0 ? `<h2>${s.title}</h2><table><thead><tr><th>日期</th><th>分類</th><th>項目</th><th>說明</th><th>人員</th><th>進度</th></tr></thead><tbody>${renderRows(s.data)}</tbody></table>` : '').join('')}</body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (e) { Alert.alert("錯誤", "PDF 失敗"); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>水灣碧潭工程週誌</Text>
        <View style={styles.searchRow}>
          <TextInput style={styles.searchBar} placeholder="🔍 搜尋內容..." value={searchQuery} onChangeText={setSearchQuery} />
          <TouchableOpacity style={styles.printBtn} onPress={handlePrint}><MaterialCommunityIcons name="file-pdf-box" size={30} color="white" /></TouchableOpacity>
        </View>
      </View>

      <SectionList
        sections={sections} keyExtractor={item => item.id}
        renderSectionHeader={({ section: { title, data } }) => data.length > 0 ? <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text></View> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{flexDirection:'row'}}><Text style={styles.tag}>{item.category}</Text><Text style={styles.dateTag}>{item.date}</Text></View>
              <Text style={[styles.progressNum, { color: item.progress === 100 ? '#4CAF50' : '#2196F3' }]}>{item.progress}%</Text>
            </View>
            <Text style={styles.taskTitle}>{item.task}</Text>
            {item.workers ? <Text style={styles.workerText}>👷 工班：{item.workers}</Text> : null}
            <Text style={styles.statusDesc}>{item.status}</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => openModal(item)}><MaterialCommunityIcons name="pencil" size={18} color="#2196F3" /><Text style={styles.blueText}> 編輯</Text></TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setTasks(tasks.filter(t => t.id !== item.id))}><MaterialCommunityIcons name="trash-can" size={18} color="#F44336" /><Text style={styles.redText}> 刪除</Text></TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => openModal()}><MaterialCommunityIcons name="plus" size={32} color="white" /></TouchableOpacity>

      {/* 主編輯 Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{isEditMode ? '修改紀錄' : '新增紀錄'}</Text>
              
              <Text style={styles.label}>項目名稱</Text>
              <TextInput style={styles.input} value={form.task} onChangeText={t => setForm({...form, task: t})} />

              <View style={styles.rowLabel}>
                <Text style={styles.label}>工程分類</Text>
                {/* 修正點：增加感應熱區與直接觸發 */}
                <TouchableOpacity 
                  onPress={() => setCatManagerVisible(true)} 
                  hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                >
                  <Text style={styles.manageText}>⚙️ 管理分類</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.catGroup}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat} style={[styles.catBtn, form.category === cat && styles.catBtnActive]} onPress={() => setForm({...form, category: cat})}>
                    <Text style={form.category === cat ? {color:'white'} : {color:'#666'}}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>進場人員 / 人數</Text>
              <TextInput style={styles.input} placeholder="如：大鼎 2人" value={form.workers} onChangeText={t => setForm({...form, workers: t})} />

              <Text style={styles.label}>日期</Text>
              <Calendar onDayPress={d => setForm({...form, date: d.dateString})} markedDates={{[form.date]: {selected: true, selectedColor: '#1A237E'}}} />

              <Text style={styles.label}>進度: {form.progress}%</Text>
              <View style={styles.catGroup}>
                {[0, 25, 50, 75, 100].map(p => (
                  <TouchableOpacity key={p} style={[styles.catBtn, form.progress === p && styles.catBtnActive]} onPress={() => setForm({...form, progress: p})}>
                    <Text style={form.progress === p ? {color:'white'} : {color:'#666'}}>{p}%</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}><Text>取消</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTask}><Text style={{color:'white', fontWeight:'bold'}}>儲存</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 管理分類 Modal：將其移出主 Modal 層級以增加 Expo Go 相容性 */}
      <Modal visible={catManagerVisible} animationType="fade" transparent={true} onRequestClose={() => setCatManagerVisible(false)}>
        <View style={styles.managerOverlay}>
          <KeyboardAvoidingView behavior="padding" style={{width:'100%'}}>
            <View style={styles.managerContent}>
              <Text style={styles.modalTitle}>管理工程分類</Text>
              <View style={styles.addCatRow}>
                <TextInput style={[styles.input, {flex:1, marginRight:10}]} placeholder="新增分類" value={newCatName} onChangeText={setNewCatName} />
                <TouchableOpacity style={styles.addBtn} onPress={addCategory}><Text style={{color:'white'}}>新增</Text></TouchableOpacity>
              </View>
              <ScrollView style={{maxHeight: 250, marginVertical: 10}}>
                {categories.map(cat => (
                  <View key={cat} style={styles.catItem}>
                    <Text style={{fontSize:16}}>{cat}</Text>
                    <TouchableOpacity onPress={() => deleteCategory(cat)} style={{padding: 8}}><MaterialCommunityIcons name="delete-outline" size={24} color="#F44336" /></TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setCatManagerVisible(false)}><Text style={{color:'white', fontWeight:'bold'}}>完成並關閉</Text></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 16, backgroundColor: '#1A237E' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchBar: { flex: 1, backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 15, height: 45 },
  printBtn: { marginLeft: 15 },
  sectionHeader: { padding: 8, backgroundColor: '#EEE' },
  sectionTitle: { fontWeight: 'bold', color: '#555', fontSize: 12 },
  card: { backgroundColor: 'white', margin: 12, padding: 15, borderRadius: 12, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  tag: { backgroundColor: '#E1F5FE', color: '#0288D1', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, fontSize: 11, fontWeight: 'bold' },
  dateTag: { fontSize: 12, color: '#999', marginLeft: 8 },
  taskTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  workerText: { fontSize: 14, color: '#1A237E', marginTop: 5, fontWeight: '600' },
  statusDesc: { fontSize: 14, color: '#666', marginTop: 4 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, borderTopWidth: 0.5, borderTopColor: '#F0F0F0', paddingTop: 10 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: 20 },
  blueText: { color: '#2196F3' }, redText: { color: '#F44336' },
  fab: { position: 'absolute', bottom: 30, right: 25, backgroundColor: '#1A237E', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, color: '#1A237E' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#444', marginTop: 15, marginBottom: 8 },
  rowLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  manageText: { fontSize: 13, color: '#1A237E', fontWeight: 'bold', textDecorationLine: 'underline', padding: 5 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#FAFAFA' },
  catGroup: { flexDirection: 'row', flexWrap: 'wrap' },
  catBtn: { borderWidth: 1, borderColor: '#DDD', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, marginRight: 8, marginBottom: 8 },
  catBtnActive: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
  modalActionRow: { flexDirection: 'row', marginTop: 20, marginBottom: 30 },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center' },
  saveBtn: { flex: 2, backgroundColor: '#1A237E', padding: 15, borderRadius: 12, alignItems: 'center' },
  managerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  managerContent: { backgroundColor: 'white', borderRadius: 20, padding: 20, width: '100%', elevation: 10 },
  addCatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  addBtn: { backgroundColor: '#4CAF50', padding: 12, borderRadius: 8 },
  catItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  closeBtn: { backgroundColor: '#1A237E', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 }
});
