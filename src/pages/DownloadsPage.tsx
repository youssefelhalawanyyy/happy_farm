import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const macUrl = import.meta.env.VITE_DOWNLOAD_MAC_URL ?? "#";
const winUrl = import.meta.env.VITE_DOWNLOAD_WIN_URL ?? "#";

export const DownloadsPage = () => (
  <section className="space-y-5">
    <PageHeader
      title="Desktop Downloads"
      description="Install Mazra3ty as a native desktop app on macOS or Windows."
    />

    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>macOS Installer</CardTitle>
          <CardDescription>DMG package for Apple Silicon and Intel.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href={macUrl} target="_blank" rel="noreferrer">
            <Button className="w-full" disabled={macUrl === "#"}>
              <Download size={14} className="mr-2" />
              Download macOS App
            </Button>
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Windows Installer</CardTitle>
          <CardDescription>NSIS setup and portable executable build.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href={winUrl} target="_blank" rel="noreferrer">
            <Button className="w-full" disabled={winUrl === "#"}>
              <Download size={14} className="mr-2" />
              Download Windows App
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  </section>
);
