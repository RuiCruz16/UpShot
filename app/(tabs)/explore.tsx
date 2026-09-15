import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

import * as alarmEngine from '../../src/engine/alarmEngine';
import { alarmStyles, colors } from '../../src/styles/alarmStyles';
import {
  addAlarm,
  formatAlarmTime,
  removeAlarm,
  setAlarmEnabled,
  type Alarm,
} from '../../src/utils/alarmStorage';
import {
  deleteReferencePhoto,
  getReferenceCount,
  listReferenceUris,
  saveReferencePhoto,
} from '../../src/utils/referencePhoto';

export default function AlarmScreen() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [refUris, setRefUris] = useState<string[]>([]);
  const [refCount, setRefCount] = useState(0);
  // Bumped whenever a reference photo changes. Same file URI (ref-0.jpg etc.)
  // means the image cache would otherwise keep showing the old thumbnail.
  const [refVersion, setRefVersion] = useState(0);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const consumingRef = useRef(false);

  const applyAlarmState = (next: Alarm[]) => setAlarms(next);

  const refreshState = useCallback(async () => {
    setAlarms(await alarmEngine.refresh());
    setRefUris(listReferenceUris());
    setRefCount(await getReferenceCount());
  }, []);

  // Reloads the reference list AND busts the image cache so fresh thumbnails
  // are shown even when the underlying file URI is unchanged.
  const applyRefUris = useCallback(async () => {
    setRefUris(listReferenceUris());
    setRefCount(await getReferenceCount());
    setRefVersion((v) => v + 1);
  }, []);

  const displayUri = useCallback(
    (uri: string) => `${uri}?v=${refVersion}`,
    [refVersion]
  );

  useEffect(() => {
    alarmEngine.init();
    return alarmEngine.subscribe(() => {
      // Force a re-render so the "ringing" banner stays in sync with the engine.
      setAlarms((current) => [...current]);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshState();
    }, [refreshState])
  );

  const processReferencePhoto = useCallback(
    async (uri: string, targetIndex?: number) => {
      if (consumingRef.current) return;
      consumingRef.current = true;
      setSaving(true);
      try {
        await saveReferencePhoto(uri, targetIndex);
        await applyRefUris();
        Alert.alert(
          'Foto guardada',
          targetIndex !== undefined
            ? 'Ângulo atualizado.'
            : 'Ângulo adicionado. Agora o objeto é reconhecido de mais perspetivas.'
        );
      } catch {
        Alert.alert('Erro', 'Não foi possível guardar a foto. Tenta novamente.');
      } finally {
        setSaving(false);
        consumingRef.current = false;
      }
    },
    [applyRefUris]
  );

  const initPhotoSource = useCallback(
    async (targetIndex?: number) => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão', 'Precisamos da câmara para tirar a foto.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled) {
        await processReferencePhoto(result.assets[0].uri, targetIndex);
      }
    },
    [processReferencePhoto]
  );

  const galleryPhotoSource = useCallback(
    async (targetIndex?: number) => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled) {
        await processReferencePhoto(result.assets[0].uri, targetIndex);
      }
    },
    [processReferencePhoto]
  );

        const pickPhoto = useCallback(
    (targetIndex?: number) => {
      const replacing = refCount > 0 && targetIndex !== undefined;
      Alert.alert(
        replacing ? 'Alterar ângulo' : 'Enviar foto do objeto',
        replacing
          ? 'Escolhe a nova foto deste ângulo.'
          : 'Guarda a foto de um objeto à tua escolha.',
        [
          { text: 'Tirar foto', onPress: () => initPhotoSource(targetIndex) },
          { text: 'Escolher da galeria', onPress: () => galleryPhotoSource(targetIndex) },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    },
    [initPhotoSource, galleryPhotoSource, refCount]
  );

  const removeAngle = useCallback(
    async (index: number) => {
      if (consumingRef.current) return;
      consumingRef.current = true;
      try {
        await deleteReferencePhoto(index);
        await applyRefUris();
      } finally {
        consumingRef.current = false;
      }
    },
    [applyRefUris]
  );

  const openTimeModal = () => {
    setSelectedTime(new Date());
    setTimeModalVisible(true);
  };

  const createAlarm = async () => {
    setTimeModalVisible(false);
    await alarmEngine.requestNotificationPermissions();
    const next = await addAlarm(selectedTime.getHours(), selectedTime.getMinutes());
    applyAlarmState(next);
    await alarmEngine.refresh();
  };

  const toggleAlarm = async (alarm: Alarm) => {
    if (alarm.enabled) {
      await alarmEngine.requestNotificationPermissions();
    }
    const next = await setAlarmEnabled(alarm.id, !alarm.enabled);
    applyAlarmState(next);
    await alarmEngine.refresh();
  };

  const deleteAlarm = async (alarm: Alarm) => {
    const next = await removeAlarm(alarm.id);
    applyAlarmState(next);
    await alarmEngine.refresh();
  };

  const ringingId = alarmEngine.getRingingAlarmId();
  const ringing = alarmEngine.isRinging();

  return (
    <View style={alarmStyles.container}>
      <Text style={alarmStyles.subtitle}>
        Acorda, fotografa o teu objeto e o som desliga-se. Se a foto não
        corresponder, o alarme continua.
      </Text>

      <View style={alarmStyles.card}>
        {refUris.length > 0 ? (
          <>
            <Text style={alarmStyles.cardTitle}>Objeto de referência</Text>
            <Text style={alarmStyles.cardText}>
              Toca numa foto para a alterar e no × para a remover.
            </Text>
            <View style={alarmStyles.referenceRow}>
              {refUris.map((uri, index) => (
                <View key={displayUri(uri)} style={alarmStyles.refThumbWrap}>
                  <TouchableOpacity
                    onPress={() => pickPhoto(index)}
                    disabled={saving}>
                    <Image source={{ uri: displayUri(uri) }} style={alarmStyles.thumbnail} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={alarmStyles.refRemove}
                    onPress={() => removeAngle(index)}
                    disabled={saving}>
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={colors.danger}
                    />
                  </TouchableOpacity>
                </View>
              ))}
              {refCount < 3 && (
                <TouchableOpacity
                  style={alarmStyles.refAdd}
                  onPress={() => pickPhoto()}
                  disabled={saving}>
                  <Ionicons name="add" size={22} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[alarmStyles.cardText, { marginTop: 10 }]}>
              {refCount}/3 ângulos guardados
              {saving ? ' • a guardar...' : ''}
            </Text>
          </>
        ) : (
          <>
            <Text style={alarmStyles.cardTitle}>Primeiro, envia uma foto</Text>
            <Text style={alarmStyles.cardText}>
              Escolhe um objeto e guarda uma foto dele. Para desligar o alarme
              tens de fotografar o mesmo objeto novamente.
            </Text>
            <View style={[alarmStyles.pickButtons, { marginTop: 14 }]}>
              <TouchableOpacity
                style={alarmStyles.pickButton}
                onPress={() => pickPhoto()}>
                <Text style={alarmStyles.pickButtonText}>📷 Tirar foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={alarmStyles.pickButton}
                onPress={() => galleryPhotoSource()}
                disabled={saving}>
                <Text style={alarmStyles.pickButtonText}>🖼️ Escolher da galeria</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {ringing && (
        <View style={[alarmStyles.card, alarmStyles.ringingCard]}>
          <Text style={[alarmStyles.cardTitle, alarmStyles.ringingTitle]}>
            ⏰ O alarme está a tocar!
          </Text>
          <Text style={[alarmStyles.cardText, alarmStyles.ringingText]}>
            Fotografa o teu objeto para desligares o som.
          </Text>
          <TouchableOpacity
            style={alarmStyles.confirmButton}
            onPress={() => router.push('/verify' as any)}>
            <Text style={alarmStyles.confirmButtonText}>Confirmar agora</Text>
          </TouchableOpacity>
        </View>
      )}

{!ringing && (
        <>
          <View style={alarmStyles.sectionHeader}>
            <Text style={alarmStyles.sectionTitle}>Alarmes</Text>
          </View>

          {alarms.length === 0 ? (
            <Text style={alarmStyles.emptyText}>
              Ainda não tens alarmes. Toca no + para adicionar um.
            </Text>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 88 }}
              showsVerticalScrollIndicator={false}>
              {alarms.map((alarm) => {
                const isRinging = alarm.id === ringingId;
                return (
                  <View
                    key={alarm.id}
                    style={[alarmStyles.alarmRow, isRinging && alarmStyles.alarmRowRinging]}>
                    <Text
                      style={[
                        alarmStyles.alarmTime,
                        !alarm.enabled && { color: colors.muted },
                      ]}>
                      {formatAlarmTime(alarm)}
                    </Text>
                    <View style={alarmStyles.enabled}>
                      <Switch
                        value={alarm.enabled}
                        onValueChange={() => toggleAlarm(alarm)}
                        style={alarmStyles.switchControl}
                        trackColor={{ true: colors.highlight, false: colors.border }}
                        thumbColor={colors.text}
                      />
                      <TouchableOpacity
                        style={alarmStyles.deleteButton}
                        onPress={() => deleteAlarm(alarm)}>
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </>
      )}

      {!ringing && (
        <TouchableOpacity style={alarmStyles.fab} onPress={openTimeModal}>
          <Ionicons name="add" size={30} color="#0F172A" />
        </TouchableOpacity>
      )}

      <Modal
        animationType="fade"
        transparent
        visible={timeModalVisible}
        onRequestClose={() => setTimeModalVisible(false)}>
        <View style={alarmStyles.modalOverlay}>
          <View style={alarmStyles.modalContent}>
            <Text style={alarmStyles.modalTitle}>Nova hora de alarme</Text>
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display="spinner"
              themeVariant="dark"
              textColor="#FFFFFF"
              onChange={(_, date) => {
                if (date) setSelectedTime(date);
              }}
            />
            <View style={alarmStyles.modalButtons}>
              <TouchableOpacity
                style={alarmStyles.modalButton}
                onPress={() => setTimeModalVisible(false)}>
                <Text style={alarmStyles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[alarmStyles.modalButton, alarmStyles.modalButtonPrimary]}
                onPress={createAlarm}>
                <Text style={[alarmStyles.modalButtonText, alarmStyles.modalButtonTextPrimary]}>
                  Criar alarme
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}