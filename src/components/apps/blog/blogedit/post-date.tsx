

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useContext, useEffect, useState } from "react";
import { BlogContext } from '../../../../context/blog-context/context';

// ShadCN UI Date Picker components
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
Popover,
PopoverContent,
PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarCog } from "lucide-react";

const PostDate = () => {
  const { posts } = useContext(BlogContext);

  const [publishDate, setPublishDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (posts.length > 0 && posts[0].createdAt) {
      setPublishDate(new Date(posts[0].createdAt));
    }
  }, [posts]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>
          <h5>Publish Date</h5>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <div className="mb-2 block">
            <Label htmlFor="publishDate">
              Select publish date <span className="text-destructive">*</span>
            </Label>
          </div>
          <div>
            <Popover>
              <PopoverTrigger className={"w-full"}>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !publishDate && "text-muted-foreground"
                  )}
                >
                  <CalendarCog />
                  {publishDate ? (
                    format(publishDate, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start">
                <Calendar
                  mode="single"
                  selected={publishDate}
                  onSelect={setPublishDate}
                />
              </PopoverContent>
            </Popover>
          </div>
          <small className="text-xs text-muted-foreground">
            Choose the date when this blog post should be published.
          </small>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostDate;
