import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useGraph } from '../hooks/useGraph';
import { GraphNode } from '../types';

const COLORS = { bg: '#0f0f0f', node: '#7c6af7', edge: '#333', text: '#f0f0f0', muted: '#666' };
const { width, height } = Dimensions.get('window');

function nodeRadius(linkCount: number): number {
  return Math.max(8, Math.min(22, 8 + linkCount * 2));
}

export function GraphScreen() {
  const navigation = useNavigation<any>();
  const { graph, loading } = useGraph();
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTransX = useSharedValue(0);
  const savedTransY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => { scale.value = savedScale.value * e.scale; })
    .onEnd(() => { savedScale.value = scale.value; });

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      translateX.value = savedTransX.value + e.translationX;
      translateY.value = savedTransY.value + e.translationY;
    })
    .onEnd(() => {
      savedTransX.value = translateX.value;
      savedTransY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Compute bounding box to center graph
  const bounds = useMemo(() => {
    if (!graph.nodes.length) return { minX: 0, minY: 0, maxX: 400, maxY: 400 };
    const xs = graph.nodes.map(n => n.x ?? 0);
    const ys = graph.nodes.map(n => n.y ?? 0);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }, [graph.nodes]);

  const svgW = Math.max(bounds.maxX - bounds.minX + 100, width);
  const svgH = Math.max(bounds.maxY - bounds.minY + 100, height - 120);
  const offsetX = -bounds.minX + 50;
  const offsetY = -bounds.minY + 50;

  const nodeMap = useMemo(() =>
    new Map(graph.nodes.map(n => [n.id, n])),
    [graph.nodes],
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.node} />
      </View>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyTitle}>No connections yet</Text>
        <Text style={styles.muted}>Use [[note title]] in notes to create links</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.canvas, animatedStyle]}>
          <Svg width={svgW} height={svgH}>
            {/* Edges */}
            {graph.edges.map(edge => {
              const src = nodeMap.get(edge.source);
              const tgt = nodeMap.get(edge.target);
              if (!src || !tgt) return null;
              return (
                <Line
                  key={edge.id}
                  x1={(src.x ?? 0) + offsetX}
                  y1={(src.y ?? 0) + offsetY}
                  x2={(tgt.x ?? 0) + offsetX}
                  y2={(tgt.y ?? 0) + offsetY}
                  stroke={COLORS.edge}
                  strokeWidth={1.5}
                  opacity={0.7}
                />
              );
            })}

            {/* Nodes */}
            {graph.nodes.map(node => {
              const cx = (node.x ?? 0) + offsetX;
              const cy = (node.y ?? 0) + offsetY;
              const r = nodeRadius(node.linkCount);
              const isSelected = selected?.id === node.id;
              return (
                <React.Fragment key={node.id}>
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={isSelected ? '#fff' : COLORS.node}
                    opacity={0.9}
                    onPress={() => {
                      if (isSelected) {
                        navigation.navigate('Editor', { noteId: node.id });
                      } else {
                        setSelected(node);
                      }
                    }}
                  />
                  <SvgText
                    x={cx}
                    y={cy + r + 12}
                    fontSize={9}
                    fill={COLORS.text}
                    textAnchor="middle"
                    opacity={0.8}>
                    {node.title.slice(0, 18)}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </Animated.View>
      </GestureDetector>

      {selected && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>{selected.title}</Text>
          <Text style={styles.tooltipSub}>{selected.linkCount} connection{selected.linkCount !== 1 ? 's' : ''} · tap again to open</Text>
        </View>
      )}

      <View style={styles.legend}>
        <Text style={styles.legendText}>{graph.nodes.length} notes · {graph.edges.length} links</Text>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  canvas: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '600', marginBottom: 8 },
  muted: { color: COLORS.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  tooltip: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  tooltipTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  tooltipSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  legend: {
    position: 'absolute',
    top: 12,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    padding: 6,
  },
  legendText: { color: COLORS.muted, fontSize: 11 },
});
