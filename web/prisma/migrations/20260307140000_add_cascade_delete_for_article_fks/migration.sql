-- AlterTable: Change article_id FK on article_like to CASCADE on delete
ALTER TABLE "article_like" DROP CONSTRAINT IF EXISTS "article_like_article_id_fkey";
ALTER TABLE "article_like" ADD CONSTRAINT "article_like_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Change article_id FK on article_category to CASCADE on delete
ALTER TABLE "article_category" DROP CONSTRAINT IF EXISTS "article_category_article_id_fkey";
ALTER TABLE "article_category" ADD CONSTRAINT "article_category_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
