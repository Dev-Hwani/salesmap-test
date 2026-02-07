import { ObjectManager } from "@/components/object/ObjectManager";

export default function ContactsPage() {
  return <ObjectManager objectType="CONTACT" apiPath="/api/contacts" />;
}
