import { ObjectManager } from "@/components/object/ObjectManager";

export default function CompaniesPage() {
  return <ObjectManager objectType="COMPANY" apiPath="/api/companies" />;
}
