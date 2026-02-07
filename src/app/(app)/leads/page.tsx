import { ObjectManager } from "@/components/object/ObjectManager";

export default function LeadsPage() {
  return <ObjectManager objectType="LEAD" apiPath="/api/leads" />;
}
