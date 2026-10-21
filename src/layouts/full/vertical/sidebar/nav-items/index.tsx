import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { ChildItem } from "../sidebaritems";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useSidebar } from '@/components/ui/sidebar-hooks';

interface NavItemProps {
  item: ChildItem;
  hasChildren: boolean;
  className?: string;
  isActive?: boolean;
}

export default function NavItem({
  item,
  hasChildren,
  className,
  isActive,
}: NavItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { state, isMobile } = useSidebar();
  const compact = state === 'collapsed' && !isMobile;

  return (

    <motion.div className={cn("flex items-center gap-3 w-full group relative py-2 my-0.5 transition-all duration-200 rounded-md", compact ? 'justify-center px-0' : 'px-3',
      isActive && "bg-primary text-background font-medium", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>

        {isHovered && (
          <motion.div
            layoutId="nav-hover-bg"
            className="absolute inset-0 bg-primary/5  rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
          />
        )}
      </AnimatePresence>

      <span className={cn('relative flex items-center gap-2 rounded-md', compact ? 'justify-center' : 'w-full')}>
        {/* Icon */}
        {item.icon && (
          <item.icon className={cn('size-4 shrink-0', item.color)} />
        )}

        {/* Name */}
        <span className={cn('font-medium', compact && 'hidden')}>{item.name}</span>

        {/* Badge */}
        {item.badge && !compact && (
          <span
            className={`ms-auto  hide-menu text-xs rounded-full px-2 py-0.5 ${item.badgeType === "filled"
              ? "bg-primary text-white dark:text-black"
              : "border border-primary text-primary"
              }`}
          >
            {item.badgeContent}
          </span>
        )}

        {/* Pro Badge */}
        {item.isPro && !compact && (
          <Badge className="ms-auto hide-menu text-[10px]! px-1.5 py-0.5 h-auto! bg-primary! text-background! rounded-md">
            Pro
          </Badge>
        )}

        {/* Chevron only if it has children */}
        {hasChildren && !compact && (
          <ChevronRight className="ms-auto h-4 w-4 transition-transform duration-200 group-open/nav:rotate-90 hide-menu" />
        )}
      </span>
    </motion.div >
  );
}
