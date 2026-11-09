import {
  Button,
  Glass,
  GlassGroup,
  Menu,
  SegmentedControl,
  Slider,
  Stepper,
  Switch,
  TabBar,
  isLiquidGlassAvailable,
} from '@onlymoein/liquidglass-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const blobs = [
  { colour: '#ff5e3a', size: 260, top: 40, left: -80 },
  { colour: '#2a3be0', size: 300, top: 260, left: 160 },
  { colour: '#e0338f', size: 220, top: 560, left: -40 },
  { colour: '#ffb02e', size: 240, top: 820, left: 180 },
  { colour: '#18c29c', size: 280, top: 1080, left: -60 },
  { colour: '#7a3cff', size: 260, top: 1340, left: 150 },
];

function Screen() {
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const ink = dark ? '#fff' : '#000';
  const [tab, setTab] = useState('controls');
  const [wifi, setWifi] = useState(true);
  const [volume, setVolume] = useState(0.6);
  const [count, setCount] = useState(2);
  const [view, setView] = useState('day');
  const [sort, setSort] = useState('name');

  return (
    <View style={[styles.fill, { backgroundColor: dark ? '#000' : '#f2f2f7' }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }}>
        {blobs.map((blob) => (
          <View
            key={blob.colour}
            style={{
              position: 'absolute',
              top: blob.top,
              left: blob.left,
              width: blob.size,
              height: blob.size,
              borderRadius: blob.size / 2,
              backgroundColor: blob.colour,
            }}
          />
        ))}

        <Text style={[styles.title, { color: ink }]}>Liquid Glass</Text>
        <Text style={[styles.note, { color: ink }]}>
          {isLiquidGlassAvailable() ? "iOS's own glass" : 'Stand-ins: this system has no Liquid Glass'}
        </Text>

        <Glass style={styles.card}>
          <Row label="Wi-Fi" ink={ink}>
            <Switch checked={wifi} onCheckedChange={setWifi} />
          </Row>
          <Row label={`Guests: ${count}`} ink={ink}>
            <Stepper value={count} onValueChange={setCount} min={0} max={10} />
          </Row>
          <Text style={[styles.label, { color: ink }]}>Volume {Math.round(volume * 100)}%</Text>
          <Slider value={volume} onValueChange={setVolume} />
        </Glass>

        <Glass style={styles.card}>
          <SegmentedControl
            items={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
              { value: 'year', label: 'Year' },
            ]}
            value={view}
            onValueChange={setView}
          />
        </Glass>

        <View style={styles.buttons}>
          <Button icon="chevron.backward" accessibilityLabel="Back" />
          <Button label="Edit" />
          <Button label="Done" variant="filled" />
          <Button icon="trash" destructive accessibilityLabel="Delete" />
        </View>

        <View style={styles.buttons}>
          <Menu
            icon="arrow.up.arrow.down"
            label="Sort"
            items={[
              { value: 'name', label: 'Name', icon: 'textformat', checked: sort === 'name' },
              { value: 'date', label: 'Date', icon: 'calendar', checked: sort === 'date' },
              { value: 'size', label: 'Size', icon: 'internaldrive', checked: sort === 'size' },
              { value: 'clear', label: 'Clear all', icon: 'trash', destructive: true },
            ]}
            onSelect={setSort}
          />
          <Button label="Small" size="small" />
          <Button label="Large" size="large" variant="filled" tint="#e0338f" />
        </View>

        <GlassGroup spacing={12} style={styles.group}>
          <Glass interactive style={styles.chip}>
            <Text style={[styles.chipText, { color: ink }]}>Merges</Text>
          </Glass>
          <Glass interactive style={styles.chip}>
            <Text style={[styles.chipText, { color: ink }]}>when close</Text>
          </Glass>
        </GlassGroup>

        <Glass variant="clear" style={styles.card}>
          <Text style={[styles.body, { color: ink }]}>
            Clear glass, for over photos. Scroll to see the glass bend the colours behind it.
          </Text>
        </Glass>
      </ScrollView>

      <View style={styles.tabs}>
        <TabBar
          items={[
            { value: 'controls', label: 'Controls', icon: 'slider.horizontal.3' },
            { value: 'glass', label: 'Glass', icon: 'circle.hexagongrid', selectedIcon: 'circle.hexagongrid.fill' },
            { value: 'saved', label: 'Saved', icon: 'bookmark', selectedIcon: 'bookmark.fill', badge: '3' },
            { value: 'settings', label: 'Settings', icon: 'gearshape', selectedIcon: 'gearshape.fill' },
          ]}
          value={tab}
          onValueChange={setTab}
        />
      </View>
    </View>
  );
}

function Row({ label, ink, children }: { label: string; ink: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: ink }]}>{label}</Text>
      {children}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Screen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  title: { fontSize: 34, fontWeight: '700', marginHorizontal: 20 },
  note: { fontSize: 15, opacity: 0.6, marginHorizontal: 20, marginBottom: 16 },
  card: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 28, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 17 },
  body: { fontSize: 17, lineHeight: 22 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 16 },
  group: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 },
  chip: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22 },
  chipText: { fontSize: 17, fontWeight: '500' },
  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
