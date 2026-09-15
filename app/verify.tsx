import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import * as alarmEngine from '../src/engine/alarmEngine';
import { alarmStyles, colors } from '../src/styles/alarmStyles';
import { comparePhotoAgainstReference, hasReferencePhoto } from '../src/utils/referencePhoto';

type Result = 'success' | 'fail' | null;

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ alarmId?: string }>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [hasRef, setHasRef] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  useEffect(() => {
    hasReferencePhoto().then(setHasRef);
  }, []);

  const finish = useCallback(async () => {
    const alarmId =
      params.alarmId ?? alarmEngine.getRingingAlarmId() ?? undefined;
    await alarmEngine.onVerificationSucceeded(alarmId);
    router.back();
  }, [params.alarmId]);

  const capture = useCallback(async () => {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    setResult(null);
    try {
      // On iOS the camera preview freezes after takePictureAsync; resume it
      // before shooting again so a failed match can easily be retried.
      await cameraRef.current.resumePreview();
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      const comparison = await comparePhotoAgainstReference(photo.uri);
      if (comparison === undefined) {
        setResult('fail');
        return;
      }
      setResult(comparison.match ? 'success' : 'fail');
      if (comparison.match) {
        setTimeout(finish, 1200);
      }
    } catch {
      setResult('fail');
    } finally {
      setBusy(false);
    }
  }, [busy, finish]);

  const ringing = alarmEngine.isRinging();

  return (
    <View style={[alarmStyles.container, { paddingBottom: 40, justifyContent: 'flex-start' }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>
        <Text style={alarmStyles.subtitle}>
          {ringing
            ? 'Fotografa o teu objeto para desligar o alarme.'
            : 'Modo de teste: fotografa o teu objeto de referência.'}
        </Text>

        {hasRef === false && (
          <View style={alarmStyles.card}>
            <Text style={alarmStyles.cardTitle}>Sem objeto de referência</Text>
            <Text style={alarmStyles.cardText}>
              Primeiro guarda uma foto no separador Alarme.
            </Text>
            <TouchableOpacity
              style={[alarmStyles.pickButton, { marginTop: 12 }]}
              onPress={() => router.back()}>
              <Text style={alarmStyles.pickButtonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        )}

        {permission && !permission.granted ? (
          <View style={alarmStyles.card}>
            <Text style={alarmStyles.cardText}>
              Precisamos do acesso à câmara para confirmar que acordaste.
            </Text>
            <TouchableOpacity
              style={[alarmStyles.pickButton, { marginTop: 12 }]}
              onPress={requestPermission}>
              <Text style={alarmStyles.pickButtonText}>Permitir câmara</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View
              style={{
                height: 420,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 16,
              }}>
              <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
              {busy && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <ActivityIndicator size="large" color={colors.highlight} />
                </View>
              )}
            </View>

            {result && (
              <View
                style={[
                  alarmStyles.card,
                  result === 'success'
                    ? { borderColor: colors.success }
                    : { borderColor: colors.danger },
                ]}>
                <Text
                  style={[
                    alarmStyles.cardTitle,
                    { color: result === 'success' ? colors.success : colors.danger },
                  ]}>
                  {result === 'success' ? 'Objeto confirmado!' : 'Não corresponde.'}
                </Text>
                <Text style={alarmStyles.cardText}>
                  {result === 'success'
                    ? 'Alarme desligado. Bom dia!'
                    : 'O objeto fotografado não bate certo com a referência. Ajusta o ângulo e iluminação e tenta novamente.'}
                </Text>
              </View>
            )}

            {result !== 'success' && (
              <TouchableOpacity
                style={alarmStyles.confirmButton}
                onPress={capture}>
                <Text style={alarmStyles.confirmButtonText}>
                  {result === 'fail' ? 'Tentar novamente' : 'Fotografar'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}