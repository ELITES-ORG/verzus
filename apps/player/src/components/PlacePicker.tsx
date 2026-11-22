import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { filterNames } from '@/lib/places';

/**
 * A pick-one list with a search box, like the venue app's address lists: the field shows the
 * choice; tapping it opens a sheet whose list narrows with every character typed.
 */
export function PlacePicker<T>(props: {
  label: string;
  /** Shown in the search box, e.g. "Search provinces". */
  searchLabel: string;
  items: T[];
  name: (item: T) => string;
  value: string | null;
  onPick: (item: T) => void;
  disabled?: boolean;
  /** Shown instead of "Choose" when disabled, e.g. "Pick a province first". */
  disabledLabel?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterNames(props.items, props.name, query), [props.items, props.name, query]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${props.label}: ${props.value ?? 'not chosen'}`}
        disabled={props.disabled}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        className={`flex-row items-center justify-between rounded-control border-2 bg-surface px-3.5 py-3 disabled:opacity-50 ${
          props.invalid ? 'border-danger' : 'border-line-strong'
        }`}
      >
        <Text className={`flex-1 text-base ${props.value ? 'text-fg' : 'text-violet'}`} numberOfLines={1}>
          {props.value ?? (props.disabled ? (props.disabledLabel ?? 'Choose') : 'Choose')}
        </Text>
        <Text className="text-xs text-fg-3">▼</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-scrim/40">
          <View className="max-h-[80%] gap-3 rounded-t-panel border-t border-line bg-surface p-4 pb-8">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-fg">{props.label}</Text>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} className="px-2 py-1">
                <Text className="font-semibold text-fg-3">Close</Text>
              </Pressable>
            </View>
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={`${props.searchLabel}…`}
              accessibilityLabel={props.searchLabel}
              className="rounded-control border-2 border-line-strong bg-surface-2 px-3.5 py-3 text-base text-fg placeholder:text-fg-3 focus:border-violet"
            />
            <FlatList
              data={shown}
              keyExtractor={(item, i) => `${props.name(item)}-${i}`}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={30}
              renderItem={({ item }) => {
                const n = props.name(item);
                const on = n === props.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      props.onPick(item);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between border-b border-line px-1 py-3 active:bg-surface-2"
                  >
                    <Text className={`text-base ${on ? 'font-semibold text-fg' : 'text-fg-2'}`}>{n}</Text>
                    {on && <Text className="text-accent">✓</Text>}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text className="px-1 py-3 text-fg-3">No matches for “{query.trim()}”.</Text>}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
