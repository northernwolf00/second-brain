import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, ActivityIndicator,
  TouchableOpacity, TextInput,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedProps, withSpring } from 'react-native-reanimated';
import { useGraph } from '../hooks/useGraph';
import { GraphNode } from '../types';
import { useTheme } from '../theme';
import { Icon } from '../components/Icon';

const { width, height } = Dimensions.get('window');

function nodeRadius(linkCount: number): number {
  return Math.max(8, Math.min(24, 8 + linkCount * 2.5));
}

interface Transform { x: number; y: number; scale: number; }

const NODE_COLORS = ['#4FD1C5', '#9F7AEA', '#F6AD55', '#4299E1', '#F687B3'];

const AnimatedG = Animated.createAnimatedComponent(G);

export function GraphScreen() {
  const navigation = useNavigation<any>();
  const { graph, loading } = useGraph();
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { colors, isDark } = useTheme();

  // Reanimated Shared Values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const savedScale = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.3, Math.min(4, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const gesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const getNodeColor = useCallback((node: GraphNode) => {
    const charCodeSum = node.title.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return NODE_COLORS[charCodeSum % NODE_COLORS.length];
  }, []);

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

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return graph.nodes;
    const low = searchQuery.toLowerCase();
    return graph.nodes.filter(n => n.title.toLowerCase().includes(low));
  }, [graph.nodes, searchQuery]);

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

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Search Header */}
      {/* <View style={styles.header}>
        <View style={[styles.headerBlur, { backgroundColor: isDark ? 'rgba(13, 17, 23, 0.9)' : 'rgba(250, 247, 242, 0.9)' }]}>
          <View style={styles.searchRow}>
            <View style={[styles.searchBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
              <Icon name="search" size={18} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search notes, tags, people..."
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <TouchableOpacity style={[styles.filterBtn, { backgroundColor: '#2D3748' }]}>
              <Icon family="ion" name="filter" size={18} color="#4FD1C5" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.projectSelectorRow}>
            <Text style={styles.viewLabel}>GRAPH VIEW</Text>
            <TouchableOpacity style={styles.projectBtn}>
              <Text style={[styles.projectBtnText, { color: colors.textSecondary }]}>Project Alpha</Text>
              <Icon family="ion" name="chevron-down" size={14} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>
      </View> */}

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.svgContainer, animatedStyle]}>
          <Svg width={svgW} height={svgH} style={styles.svg}>
            <Defs>
              {NODE_COLORS.map(color => (
                <RadialGradient id={`grad-${color.slice(1)}`} key={color} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <Stop offset="0%" stopColor={color} stopOpacity="1" />
                  <Stop offset="100%" stopColor={color} stopOpacity="0.2" />
                </RadialGradient>
              ))}
            </Defs>
            <G transform={`translate(${offsetX}, ${offsetY})`}>
              {graph.edges.map(edge => {
                const src = nodeMap.get(edge.source);
                const tgt = nodeMap.get(edge.target);
                if (!src || !tgt) return null;
                return (
                  <Line
                    key={edge.id}
                    x1={src.x ?? 0} y1={src.y ?? 0}
                    x2={tgt.x ?? 0} y2={tgt.y ?? 0}
                    stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                    strokeWidth={1}
                  />
                );
              })}
              {filteredNodes.map(node => {
                const cx = node.x ?? 0;
                const cy = node.y ?? 0;
                const r = nodeRadius(node.linkCount);
                const isSelected = selected?.id === node.id;
                const nodeColor = getNodeColor(node);

                return (
                  <G key={node.id}>
                    {/* Outer glow */}
                    <Circle
                      cx={cx} cy={cy} r={r + 8}
                      fill={`url(#grad-${nodeColor.slice(1)})`}
                      opacity={isSelected ? 0.8 : 0.4}
                    />
                    <Circle
                      cx={cx} cy={cy} r={r}
                      fill={nodeColor}
                      onPress={() => setSelected(node)}
                    />
                    <SvgText
                      x={cx} y={cy + r + 16}
                      fontSize={11} fontWeight="500"
                      fill={colors.textSecondary}
                      textAnchor="middle" opacity={isSelected ? 1 : 0.7}>
                      {node.title.slice(0, 20)}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          </Svg>
        </Animated.View>
      </GestureDetector>

      {/* Selected Node Premium Callout */}
      {selected && (
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <View style={styles.calloutWrapper}>
            <View style={[styles.calloutBlur, { backgroundColor: 'rgba(30, 41, 59, 0.95)' }]}>
              <View style={styles.calloutContent}>
                <Text style={styles.calloutTitle}>{selected.title}</Text>
                <Text style={styles.calloutSub}>{selected.linkCount} Connections</Text>
                <View style={styles.calloutActions}>
                  <TouchableOpacity 
                    style={styles.calloutActionBtn}
                    onPress={() => navigation.navigate('Editor', { noteId: selected.id })}>
                    <Icon family="ion" name="shuffle" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
              {/* Caret/Tail */}
              <View style={styles.calloutCaret} />
            </View>
            <TouchableOpacity style={styles.closeOverlay} onPress={() => setSelected(null)} />
          </View>
        </View>
      )}

      {/* Stats legend */}
      {!selected && (
        <View style={styles.bottomLegend}>
          <Text style={[styles.legendText, { color: colors.muted }]}>
            {graph.nodes.length} notes · {graph.edges.length} links
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  headerBlur: {
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', 
    height: 44, borderRadius: 12, paddingHorizontal: 12, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  filterBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  projectSelectorRow: { alignItems: 'center' },
  viewLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginBottom: 4 },
  projectBtn: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  projectBtnText: { fontSize: 14, fontWeight: '600' },

  svgContainer: { flex: 1 },
  svg: { flex: 1, backgroundColor: 'transparent' },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyHint: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },

  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  calloutWrapper: {
    width: 200,
    alignItems: 'center',
  },
  calloutBlur: {
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    padding: 20,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  calloutContent: { alignItems: 'center' },
  calloutTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4, textAlign: 'center' },
  calloutSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 },
  calloutActions: { marginTop: 4 },
  calloutActionBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(79, 209, 197, 0.3)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(79, 209, 197, 0.5)',
  },
  calloutCaret: {
    position: 'absolute', bottom: -10,
    width: 20, height: 20, backgroundColor: 'rgba(30, 41, 59, 1)',
    transform: [{ rotate: '45deg' }],
    zIndex: -1,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  closeOverlay: {
    position: 'absolute', top: -1000, bottom: -1000, left: -1000, right: -1000,
    backgroundColor: 'transparent',
    zIndex: -2,
  },
  bottomLegend: {
    position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center',
  },
  legendText: { fontSize: 12, fontWeight: '500' },
});
