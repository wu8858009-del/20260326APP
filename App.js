import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, SafeAreaView,
  TouchableOpacity, Modal, TextInput, Alert, useWindowDimensions, Platform, Button, TouchableWithoutFeedback, KeyboardAvoidingView
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

const App = () => {
  const { width } = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState(false);

  // 計算本週週一至週五的日期範圍
  const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(new Date().setDate(diffToMon));
    const fri = new Date(new Date().setDate(diffToMon + 4));
    const fmt = (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    return `${fmt(mon)} ~ ${fmt(fri)}`;
  };

  // 取得當天日期
  const getTodayDate = () => {
    const now = new Date();
    const fmt = (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    return fmt(now);
  };

  // --- 表單狀態 ---
  const [newTask, setNewTask] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newProgress, setNewProgress] = useState('0%');
  const [targetCategory, setTargetCategory] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateValue, setDateValue] = useState(new Date());
  const [editingItem, setEditingItem] = useState(null);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [activeProgressItem, setActiveProgressItem] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);

  const DatePickerAndroid = {
    open: (options) => new Promise((resolve) => {
      if (Platform.OS === 'android') {
        DateTimePickerAndroid.open({
          value: selectedDate || new Date(),
          ...options,
          onChange: (event, date) => {
            if (event.type === 'set') resolve(date);
          }
        });
      } else {
        Alert.alert("提示", "DatePickerAndroid 僅支援 Android 平台");
      }
    })
  };

  const handleOpenDateModal = () => {
    setDateModalVisible(true);
  };

  const handleCloseDateModal = () => {
    setDateModalVisible(false);
  };

  const handleDateConfirm = (date) => {
    setSelectedDate(date);
    handleCloseDateModal();
  };

  const renderDateModal = () => {
    return (
      <Modal visible={dateModalVisible} animationType="slide" transparent={true}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleCloseDateModal}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <Button title="開啟日曆" onPress={() => DatePickerAndroid.open({ mode: "date" }).then(handleDateConfirm)} />
              <Button title="關閉" onPress={handleCloseDateModal} />
              {selectedDate && <Text style={{ textAlign: 'center', marginTop: 10, fontSize: 16, color: '#fff' }}>選擇日期: {selectedDate.toISOString().substr(0, 10)}</Text>}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    );
  };

  // --- 工班進場專用狀態 ---
  const [newDays, setNewDays] = useState(Array(7).fill(false));
  const [scheduleData, setScheduleData] = useState([
    { id: 101, days: Array(7).fill(false) },

  ]);

  const [data, setData] = useState([
    {
      category: "已完成事項",
      items: [
        { id: 1, task: "屋頂落葉處理", status: "定期維護", date: "2026/03/18", progress: "100%" },
      ]
    },
    {
      category: "需要待修 / 追蹤事項",
      items: [
        { id: 2, task: "碧水堂高壓軟管破管", status: "待處理", date: "2026/03/25", progress: "0%" },
      ]
    }
  ]);

  const handleProgressChange = (progress) => {
    setNewProgress(progress);
    if (progress === '100%') {
      setTargetCategory(0);
      if (!newStatus || newStatus === '待處理') setNewStatus('已完成');
    } else {
      setTargetCategory(1);
      if (!newStatus || newStatus === '已完成') setNewStatus('待處理');
    }
  };

  const openEditModal = (sectionIdx, item, isSch = false) => {
    setEditingItem({ sectionIdx, id: item.id, isSch });
    setTargetCategory(isSch ? 2 : sectionIdx);
    if (isSch) {
      setNewDays(item.days);
    } else {
      setNewTask(item.task);
      setNewStatus(item.status);
      setNewDate(item.date || '');
      setNewProgress(item.progress);
    }
    setModalVisible(true);
  };

  const handleSave = () => {
    if (targetCategory === 2) {
      const updated = scheduleData.map(item =>
        item.id === editingItem?.id ? { ...item, days: newDays } : item
      );
      setScheduleData(updated);
    } else {
      if (newTask.trim() === '') return;
      const newData = [...data];
      const itemData = { task: newTask, status: newStatus, date: newDate, progress: newProgress };

      if (editingItem) {
        const { sectionIdx, id } = editingItem;
        newData[sectionIdx].items = newData[sectionIdx].items.filter(i => i.id !== id);
        newData[targetCategory].items.push({ id, ...itemData });
      } else {
        newData[targetCategory].items.push({ id: Date.now(), ...itemData });
      }
      setData(newData);
    }
    closeModal();
  };

  const closeModal = () => {
    setModalVisible(false);
    setNewTask(''); setNewStatus(''); setNewDate(''); setNewProgress('0%');
    setTargetCategory(1); setEditingItem(null);
    setNewDays(Array(7).fill(false));
  };

  const openProgressModal = (sectionIdx, item) => {
    setActiveProgressItem({ sectionIdx, item });
    setProgressModalVisible(true);
  };

  const fastUpdateProgress = (val) => {
    if (!activeProgressItem) return;
    const { sectionIdx, item } = activeProgressItem;
    const newData = [...data];

    newData[sectionIdx].items = newData[sectionIdx].items.filter(i => i.id !== item.id);
    const targetCat = val === '100%' ? 0 : 1;
    const newStatus = val === '100%' ? '已完成' : '待處理';
    newData[targetCat].items.push({ ...item, progress: val, status: newStatus });

    setData(newData);
    setProgressModalVisible(false);
  };

  // 抽離出來的格式化邏輯
  const updateFormattedDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    setNewDate(`${y}/${m}/${d}`);
  };

  const onDateChange = (event, selectedDate) => {
    // 1. 先更新當前選擇的時間
    const currentDate = selectedDate || dateValue;
    setDateValue(currentDate);

    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set') {
        updateFormattedDate(currentDate);
      }
    } else {
      // iOS 與 Web 邏輯：滾動或點選即更新
      updateFormattedDate(currentDate);
    }
  };

  const deleteItem = (sectionIdx, itemId) => {
    const confirmDelete = () => {
      const newData = [...data];
      newData[sectionIdx].items = newData[sectionIdx].items.filter(i => i.id !== itemId);
      setData(newData);
    };

    if (Platform.OS === 'web') {
      if (window.confirm("確定要刪除這筆紀錄嗎？")) confirmDelete();
    } else {
      Alert.alert("刪除確認", "確定要刪除這筆紀錄嗎？", [
        { text: "取消", style: "cancel" },
        { text: "刪除", style: "destructive", onPress: confirmDelete }
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => { setEditingItem(null); setModalVisible(true); }}
      >
        <Text style={styles.addButtonText}>＋ 新增資料</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentInner}>
          <View style={styles.header}>
            <Text style={styles.companyName}>水灣企業股份有限公司</Text>
            <Text style={styles.reportTitle}>工作週誌</Text>
          </View>

          <View style={styles.tableWrapper}>
            <View style={styles.weekInfoBar}>
              <Text style={styles.weekInfoText}>本週日期：{getWeekRange()}</Text>
              <Text style={styles.weekInfoText}>當天日期：{getTodayDate()}</Text>
            </View>
            <View style={[styles.row, styles.tableHeader]}>
              <Text style={[styles.cell, styles.bold, { flex: 1, textAlign: 'center' }]}>編號</Text>
              <Text style={[styles.cell, styles.bold, { flex: 3 }]}>工作項目</Text>
              <Text style={[styles.cell, styles.bold, { flex: 1.8 }]}>狀態說明</Text>
              <Text style={[styles.cell, styles.bold, { flex: 1.5, textAlign: 'center' }]}>預計完成</Text>
              <Text style={[styles.cell, styles.bold, { flex: 1.2, textAlign: 'center' }]}>進度</Text>
            </View>

            {data.map((section, sIdx) => (
              <View key={sIdx}>
                <View style={[styles.categoryRow, sIdx === 1 && styles.alertCategory]}>
                  <Text style={styles.categoryText}>{section.category}</Text>
                </View>
                {section.items.map((item, iIdx) => (
                  <View key={item.id} style={styles.row}>
                    <TouchableOpacity
                      style={{ flex: 7.3, flexDirection: 'row' }}
                      onPress={() => openEditModal(sIdx, item)}
                      onLongPress={() => deleteItem(sIdx, item.id)}
                    >
                      <Text style={[styles.cell, { flex: 1, textAlign: 'center' }]}>{iIdx + 1}</Text>
                      <Text style={[styles.cell, { flex: 3 }]}>{item.task}</Text>
                      <Text style={[styles.cell, { flex: 1.8 }]}>{item.status}</Text>
                      <Text style={[styles.cell, { flex: 1.5, textAlign: 'center' }]}>{item.date}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.cell, { flex: 1.2 }]} onPress={() => openProgressModal(sIdx, item)}>
                      <Text style={{ textAlign: 'center', color: '#007AFF', fontWeight: 'bold' }}>{item.progress}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* 進場工作排程表 */}
          <View style={[styles.tableWrapper, { marginTop: 30 }]}>
            <View style={styles.categoryRow}>
              <Text style={styles.categoryText}>工班進場</Text>
            </View>
            <View style={[styles.row, styles.tableHeader]}>
              {['一', '二', '三', '四', '五', '六', '日'].map(day => (
                <Text key={day} style={[styles.cell, styles.bold, { flex: 1, textAlign: 'center' }]}>{day}</Text>
              ))}
            </View>
            {scheduleData.map((item) => (
              <TouchableOpacity
                key={item.id} style={styles.row}
                onPress={() => openEditModal(null, item, true)}
              >
                {item.days.map((d, i) => (
                  <Text key={i} style={[styles.cell, { flex: 1, textAlign: 'center', height: 40 }]}>{d ? 'V' : ''}</Text>
                ))}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 編輯/新增 Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{editingItem ? "修改紀錄" : "新增紀錄"}</Text>

                {targetCategory === 2 ? (
                  <>
                    <Text style={styles.label}>點擊選擇進場日期</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, marginTop: 10 }}>
                      {['一', '二', '三', '四', '五', '六', '日'].map((day, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={{ padding: 8, backgroundColor: newDays[idx] ? '#007AFF' : '#3a3a3c', borderRadius: 4, minWidth: 35, alignItems: 'center' }}
                          onPress={() => {
                            const d = [...newDays]; d[idx] = !d[idx]; setNewDays(d);
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 12 }}>{day}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>工作項目</Text>
                    <TextInput style={styles.input} value={newTask} onChangeText={setNewTask} placeholder="內容" placeholderTextColor="#666" />
                    <Text style={styles.label}>狀態說明</Text>
                    <TextInput style={styles.input} value={newStatus} onChangeText={setNewStatus} placeholder="狀態" placeholderTextColor="#666" />
                    <Text style={styles.label}>預計完成日期 (YYYY/MM/DD 或 簡寫如MM/DD)</Text>
                    <TextInput
                      style={styles.input}
                      value={newDate}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/\D/g, ''); // 只保留數字
                        let formatted = cleaned;
                        if (cleaned.length > 4) formatted = `${cleaned.slice(0, 4)}/${cleaned.slice(4, 6)}`;
                        if (cleaned.length > 6) formatted = `${formatted}/${cleaned.slice(6, 8)}`;
                        setNewDate(formatted);
                      }}
                      onBlur={() => {
                        const cleaned = newDate.replace(/\D/g, '');
                        if (cleaned.length === 3 || cleaned.length === 4) {
                          const year = new Date().getFullYear();
                          const month = cleaned.length === 3 ? '0' + cleaned[0] : cleaned.slice(0, 2);
                          const day = cleaned.length === 3 ? cleaned.slice(1) : cleaned.slice(2);
                          setNewDate(`${year}/${month}/${day}`);
                        }
                      }}
                      placeholder="例如: 325 或 20260325"
                      placeholderTextColor="#666"
                      keyboardType="number-pad"
                      maxLength={10}
                    />
                  </>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}><Text style={styles.cancelBtnText}>取消</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSave}><Text style={styles.whiteText}>儲存</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* 進度百分比選擇 Modal */}
      <Modal visible={progressModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setProgressModalVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>更改進度</Text>
              <TouchableOpacity style={styles.progressOption} onPress={() => fastUpdateProgress('0%')}>
                <Text style={[styles.progressOptionText, { color: '#FF453A' }]}>0% (待處理)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.progressOption} onPress={() => fastUpdateProgress('100%')}>
                <Text style={[styles.progressOptionText, { color: '#32D74B' }]}>100% (已完成)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelBtn, { marginTop: 10 }]} onPress={() => setProgressModalVisible(false)}><Text style={[styles.cancelBtnText, { textAlign: 'center' }]}>取消</Text></TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* 日期選擇 Modal */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <TouchableOpacity style={styles.datePickerOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.datePickerSheet}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}><Text style={styles.linkText}>取消</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  updateFormattedDate(dateValue);
                  setShowDatePicker(false);
                }}><Text style={styles.confirmText}>完成</Text></TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateValue}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={onDateChange}
                minimumDate={new Date()}
                themeVariant="dark"
              />
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
      {renderDateModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  addButton: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#007AFF', padding: 15, borderRadius: 30, zIndex: 10, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  scrollContent: { padding: 15, paddingTop: 20, paddingBottom: 100, alignItems: 'center' },
  contentInner: { width: '100%', maxWidth: 1000 }, // 限制電腦端最大寬度
  header: { alignItems: 'center', marginBottom: 25 },
  companyName: { fontSize: 18, color: '#333' },
  reportTitle: { fontSize: 24, fontWeight: 'bold', color: '#000', marginTop: 5 },
  tableWrapper: { borderWidth: 1, borderColor: '#000', backgroundColor: '#fff' },
  weekInfoBar: { backgroundColor: '#f8f9fa', padding: 5, borderBottomWidth: 1, borderColor: '#000', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
  weekInfoText: { fontSize: 12, fontWeight: 'bold', color: '#444' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000' },
  tableHeader: { backgroundColor: '#eee' },
  bold: { fontWeight: 'bold' },
  cell: { padding: 8, borderRightWidth: 1, borderColor: '#000', fontSize: 13, justifyContent: 'center' },
  categoryRow: { backgroundColor: '#f9f9f9', padding: 8, borderBottomWidth: 1, borderColor: '#000' },
  alertCategory: { backgroundColor: '#ffe6e6' },
  categoryText: { fontWeight: 'bold' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#1c1c1e', padding: 20, borderRadius: 12, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#fff' },
  label: { fontSize: 12, color: '#999', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#38383a', padding: 10, borderRadius: 6, marginBottom: 15, minHeight: 40, justifyContent: 'center', color: '#fff', backgroundColor: '#2c2c2e' },
  inputText: { color: '#fff' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { padding: 10 },
  cancelBtnText: { color: '#999' },
  saveBtn: { backgroundColor: '#212529', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6 },
  whiteText: { color: '#fff', fontWeight: 'bold' },
  datePickerOverlay: { flex: 1, justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center' },
  progressOption: { backgroundColor: '#2c2c2e', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#38383a' },
  progressOptionText: { textAlign: 'center', fontSize: 16, fontWeight: '500', color: '#fff' },
  datePickerSheet: { backgroundColor: '#1c1c1e', borderRadius: 12, width: '90%', maxWidth: 400, paddingBottom: 20 },
  datePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 0.5, borderColor: '#38383a' },
  linkText: { color: '#0A84FF' },
  confirmText: { color: '#0A84FF', fontWeight: 'bold' },
});

export default App;
