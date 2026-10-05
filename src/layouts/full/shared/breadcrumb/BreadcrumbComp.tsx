import { Card } from '@/components/ui/card';
import { Link } from 'react-router';
interface BreadcrumbItem { to?: string; title: string }
interface BreadCrumbType { subtitle?: string; items?: BreadcrumbItem[]; title: string }
const BreadcrumbComp = ({ title, items }: BreadCrumbType) => {
  const parents = items ?? (title === '全部项目' ? [] : [{ title: '全部项目', to: '/projects' }]);
  return <Card className="overflow-hidden rounded-xl border bg-background px-6 py-5">
    <div className="relative flex flex-wrap items-center justify-between gap-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <nav aria-label="当前位置"><ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {parents.map((item) => <li key={item.title} className="flex items-center gap-2">{item.to ? <Link className="hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-ring" to={item.to}>{item.title}</Link> : item.title}<span aria-hidden="true">/</span></li>)}
        <li aria-current="page" className="text-foreground">{title}</li>
      </ol></nav>
    </div>
  </Card>;
};
export default BreadcrumbComp;
