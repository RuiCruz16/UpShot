import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../../src/styles/homeStyles';
import { getWakeUpTimes, WakeUpTime } from '../../src/utils/sleepCalculator';

export default function App() {
  const [wakeUpTimes, setWakeUpTimes] = useState<WakeUpTime[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Estado que guarda a hora que estás a escolher no slider
  const [selectedTime, setSelectedTime] = useState(new Date());

  // Função 1: Calcula com a hora atual
  const handleCalculateNow = () => {
    const times = getWakeUpTimes();
    setWakeUpTimes(times);
    setModalVisible(true);
  };

  // Função 2: Calcula com a hora do slider
  const handleCalculateCustom = () => {
    const times = getWakeUpTimes(selectedTime);
    setWakeUpTimes(times);
    setModalVisible(true);
  };

  // Atualiza a hora no estado silenciosamente, sem abrir popup!
  const onTimeChange = (event: any, date?: Date) => {
    if (date) {
      setSelectedTime(date);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sleep Calculator 🌙</Text>
      
      <Text style={styles.infoText}>
        Calculamos a tua hora de acordar assumindo que demoras <Text style={styles.highlight}>15 minutos</Text> a adormecer. 
        O ideal é acordar no fim de um ciclo de <Text style={styles.highlight}>90 minutos</Text> (sugerimos <Text style={styles.highlight}>5 a 6 ciclos</Text>).
      </Text>
      
      <View style={styles.buttonsContainer}>
        
        {/* Botão de Dormir Agora */}
        <TouchableOpacity style={[styles.mainButton, styles.mainButtonHighlight]} onPress={handleCalculateNow}>
          <Text style={styles.mainButtonTextHighlight}>Dormir Agora</Text>
        </TouchableOpacity>

        {/* 2. Slider embutido no ecrã (Sempre visível) */}
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display="spinner"
            themeVariant="dark" // 3. Força as letras a ficarem brancas no iOS
            textColor="#FFFFFF" // Garantia extra para o texto branco
            onChange={onTimeChange}
          />
        </View>

        {/* Botão para calcular baseado na hora do slider */}
        <TouchableOpacity style={styles.mainButton} onPress={handleCalculateCustom}>
          <Text style={styles.mainButtonText}>Dormir às...</Text>
        </TouchableOpacity>

      </View>

      {/* POPUP (MODAL) */}
      <Modal
        animationType="fade" // Fade evita o "bug" do ecrã preto melhor que o slide
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Horas Sugeridas</Text>
            
            <FlatList
              data={wakeUpTimes}
              keyExtractor={(item) => item.cycles.toString()}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.timeInfo}>
                    <Text style={styles.timeText}>{item.time}</Text>
                    <Text style={styles.detailText}>
                      {item.cycles} Ciclos • {item.hoursOfSleep}h sono
                    </Text>
                  </View>
                  
                  {item.isSuggested && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>SUGERIDO</Text>
                    </View>
                  )}
                </View>
              )}
            />

            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}