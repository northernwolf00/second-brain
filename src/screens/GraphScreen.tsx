import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, ActivityIndicator,
  PanResponder, GestureResponderEvent, PanResponderGestureState, TouchableOpacity,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useGraph } from '../hooks/useGraph';
import { GraphNode } from '../types';
import { useTheme } from '../theme';
import { Icon } from '../components/Icon';

const { width, height } = Dimensions.get('window');

function nodeRadius(linkCount: number): number {
  return Math.max(8, Math.min(24, 8 + linkCount * 2.5));
}

interface Transform { x: number; y: number; scale: number; }

export function GraphScreen() {
  const navigation = useNavigation<any>();
  const { graph, loading } = useGraph();
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const { colors } = useTheme();

  const lastTransform = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const lastPinchDistance = useRef<number | null>(null);

  function distance(touches: { pageX: number; pageY: number }[]): number {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_e: GestureResponderEvent) => {
        lastTransform.current = transform;
        lastPinchDistance.current = null;
      },
      onPanResponderMove: (e: GestureResponderEvent, gs: PanResponderGestureState) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
          const dist = distance(touches as unknown as { pageX: number; pageY: number }[]);
          if (lastPinchDistance.current !== null) {
            const ratio = dist / lastPinchDistance.current;
            setTransform(prev => ({
              ...prev,
              scale: Math.max(0.3, Math.min(4, lastTransform.current.scale * ratio)),
            }));
          }
          lastPinchDistance.current = dist;
        } else {
          lastPinchDistance.current = null;
          setTransform(prev => ({
            ...prev,
            x: lastTransform.current.x + gs.dx,
            y: lastTransform.current.y + gs.dy,
          }));
        }
      },
      onPanResponderRelease: () => {
        lastTransform.current = transform;
        lastPinchDistance.current = null;
      },
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ).current;

  const bounds = useMemo(() => {
    if (!graph.nodes.length) return { minX: 0, minY: 0, maxX: 400, maxY: 400 };
    const xs = graph.nodes.map(n => n.x ?? 0);
    const ys = graph.nodes.map(n => n.y ?? 0);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  }, [graph.nodes]);

  const svgW = Math.max(bounds.maxX - bounds.minX + 100, width);
  const svgH = Math.max(bounds.maxY - bounds.minY + 100, height - 120);
  const offsetX = -bounds.minX + 50;
  const offsetY = -bounds.minY + 50;

  const nodeMap = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph.nodes]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.bg }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: colors.accentSoft }]}>
          <Icon name="bubble-chart" size={36} color={colors.accent} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No connections yet</Text>
        <Text style={[styles.emptyHint, { color: colors.muted }]}>
          Use {'[[note title]]'} in notes to create links
        </Text>
      </View>
    );
  }

  const tx = `translate(${transform.x}, ${transform.y}) scale(${transform.scale})`;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]} {...panResponder.panHandlers}>
      <Svg width={width} height={height - 120} style={styles.svg}>
        <G transform={tx}>
          {graph.edges.map(edge => {
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt) return null;
            return (
              <Line
                key={edge.id}
                x1={(src.x ?? 0) + offsetX} y1={(src.y ?? 0) + offsetY}
                x2={(tgt.x ?? 0) + offsetX} y2={(tgt.y ?? 0) + offsetY}
                stroke={colors.border} strokeWidth={1.5} opacity={0.8}
              />
            );
          })}
          {graph.nodes.map(node => {
            const cx = (node.x ?? 0) + offsetX;
            const cy = (node.y ?? 0) + offsetY;
            const r = nodeRadius(node.linkCount);
            const isSelected = selected?.id === node.id;
            return (
              <G key={node.id}>
                <Circle
                  cx={cx} cy={cy} r={r + (isSelected ? 4 : 0)}
                  fill={isSelected ? colors.text : colors.accent}
                  opacity={isSelected ? 1 : 0.85}
                  onPress={() => {
                    if (isSelected) navigation.navigate('Editor', { noteId: node.id });
                    else setSelected(node);
                  }}
                />
                <SvgText
                  x={cx} y={cy + r + 14}
                  fontSize={9} fill={colors.textSecondary}
                  textAnchor="middle" opacity={0.9}>
                  {node.title.slice(0, 18)}
                </SvgText>
              </G>
            );
          })}
        </G>
      </Svg>

      {/* Stats badge */}
      <View style={[styles.legend, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.legendText, { color: colors.muted }]}>
          {graph.nodes.length} notes · {graph.edges.length} links
        </Text>
      </View>

      {/* Selected node tooltip */}
      {selected && (
        <View style={[styles.tooltip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.tooltipRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tooltipTitle, { color: colors.text }]} numberOfLines={1}>
                {selected.title}
              </Text>
              <Text style={[styles.tooltipSub, { color: colors.muted }]}>
                {selected.linkCount} connection{selected.linkCount !== 1 ? 's' : ''} · tap again to open
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.tooltipBtn, { backgroundColor: colors.accent }]}
              onPress={() => navigation.navigate('Editor', { noteId: selected.id })}>
              <Icon name="open-in-new" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  svg: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyHint: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  legend: {
    position: 'absolute', top: 16, right: 16,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  legendText: { fontSize: 11, fontWeight: '600' },
  tooltip: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    borderRadius: 16, padding: 16, borderWidth: 1,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tooltipTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  tooltipSub: { fontSize: 12 },
  tooltipBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
