import { Text, type StyleProp, type TextStyle } from 'react-native';

import { garageContent } from '../garage/content';
import { gt } from '../garage/text';
import { cosmeticsAt } from './logic';
import { useMetaStore } from './store';

/** The Lab Rep title shown under the lab name ("Garage Legend"); nothing before one is earned. */
export function LabTitle({ style }: { style?: StyleProp<TextStyle> }) {
  const labRep = useMetaStore((s) => s.labRep);
  const content = garageContent();
  const title = cosmeticsAt(content, Math.floor(labRep + 1e-9)).title;
  if (!title?.effect.key) return null;
  return (
    <Text style={style} numberOfLines={1} testID="lab-title">
      {gt(title.effect.key, undefined, content)}
    </Text>
  );
}
