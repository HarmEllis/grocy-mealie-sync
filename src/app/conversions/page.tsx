import { getConversionLibrary } from '@/lib/conversions/catalog';
import { ConversionLibrary } from '@/components/conversions/ConversionLibrary';

export default function ConversionsPage() {
  return <ConversionLibrary catalog={getConversionLibrary()} />;
}
