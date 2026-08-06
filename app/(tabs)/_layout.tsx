import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

/**
 * Barra de navegação flutuante estilo "Dynamic Island" da Apple.
 * - Fundo azul (mesmo tom do botão "Dormir às" — ver ISLAND_BLUE abaixo)
 * - Sempre centrada na horizontal
 * - Ocupa ~40% da largura do ecrã
 * - Item selecionado fica a AMARELO (ícone + texto), sem "bola" de fundo
 */

// Mesmas cores do botão "Dormir às" (styles.mainButton)
const ISLAND_BLUE = '#1E293B';
const ISLAND_BLUE_BORDER = '#334155';

const ACTIVE_COLOR = '#FDE047'; // amarelo do item selecionado (mesmo do highlight)
const INACTIVE_COLOR = '#94A3B8'; // cinza-azulado dos itens inativos

function IslandTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  // ~40% do ecrã, com limites para não ficar demasiado pequena/grande
  const islandWidth = Math.min(Math.max(width * 0.4, 200), 340);

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View style={[styles.island, { width: islandWidth }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.title !== undefined ? options.title : route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;
          const icon = options.tabBarIcon?.({
            focused: isFocused,
            color,
            size: 22,
          });

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label as string}
              onPress={onPress}
              style={styles.tabButton}>
              <View style={styles.tabInner}>
                {icon}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    { color },
                    isFocused && styles.labelActive,
                  ]}>
                  {label as string}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <IslandTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Calculadora',
          tabBarIcon: ({ color }) => (
            <Ionicons name="moon" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Alarme',
          tabBarIcon: ({ color }) => (
            <Ionicons name="alarm" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Separação do conteúdo acima: flutua acima da margem inferior
    bottom: Platform.select({ ios: 28, android: 20, default: 20 }),
    alignItems: 'center',
  },
  island: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: ISLAND_BLUE,
    borderRadius: 40, // forma de "pílula" tipo Dynamic Island
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: ISLAND_BLUE_BORDER,
    // Sombra para dar o efeito flutuante / separação
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '700',
  },
});
