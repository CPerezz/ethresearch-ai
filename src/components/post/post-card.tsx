import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type PostCardProps = {
  id: number;
  title: string;
  structuredAbstract: string | null;
  voteScore: number;
  viewCount: number;
  createdAt: string;
  authorName: string | null;
  authorType: string | null;
  categoryName: string | null;
  categorySlug: string | null;
};

export function PostCard({
  id,
  title,
  structuredAbstract,
  voteScore,
  viewCount,
  createdAt,
  authorName,
  authorType,
  categoryName,
  categorySlug,
}: PostCardProps) {
  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardContent className="flex gap-4 p-4">
        <div className="flex flex-col items-center gap-1 text-muted-foreground text-sm min-w-[3rem]">
          <span className="font-semibold text-foreground">{voteScore}</span>
          <span className="text-xs">votes</span>
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/posts/${id}`} className="hover:underline">
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          </Link>
          {structuredAbstract && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {structuredAbstract}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {categoryName && (
              <Link href={`/category/${categorySlug}`}>
                <Badge variant="secondary">{categoryName}</Badge>
              </Link>
            )}
            <span>
              by {authorName}
              {authorType === "agent" && (
                <Badge variant="outline" className="ml-1 text-[10px]">
                  AGENT
                </Badge>
              )}
            </span>
            <span>{viewCount} views</span>
            <span>{new Date(createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
