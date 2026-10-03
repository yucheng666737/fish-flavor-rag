using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

class Launcher : Form {
    readonly string home = AppDomain.CurrentDomain.BaseDirectory;
    string app, node, env, url;
    Process server, importer;
    bool closing;
    Label status;
    Button start, stop, open, ingest;
    [STAThread] static void Main() { Application.EnableVisualStyles(); Application.Run(new Launcher()); }
    public Launcher() {
        Text = "風味設計 RAG — 本機展示";
        ClientSize = new Size(570, 295); FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false; StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Microsoft JhengHei UI", 10);
        app = File.Exists(Path.Combine(home,"app","server.js")) ? Path.Combine(home,"app") : home;
        node = Path.Combine(home,"runtime","node.exe");
        if (!File.Exists(node)) node = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"nodejs","node.exe");
        env = Path.Combine(home,".env");
        Controls.Add(new Label { Text="AI 風味設計展示", Font=new Font(Font.FontFamily,18,FontStyle.Bold), Location=new Point(24,20), AutoSize=true });
        Controls.Add(new Label { Text="先填入自己的 API 金鑰，首次使用再匯入知識。\nAI 功能需要網路；視窗關閉會停止本次啟動的服務。", Location=new Point(24,65), Size=new Size(520,50) });
        AddButton("開啟設定",24,125,OpenSettings);
        ingest=AddButton("匯入知識",198,125,Import);
        start=AddButton("啟動展示",372,125,StartServer);
        stop=AddButton("停止展示",24,180,StopServer); stop.Enabled=false;
        open=AddButton("重開展示頁",198,180,(s,e)=>OpenBrowser()); open.Enabled=false;
        status=new Label { Text="尚未啟動。金鑰只從旁邊的 .env 讀取。",Location=new Point(24,240),Size=new Size(520,45) }; Controls.Add(status);
        FormClosing += (s,e) => { closing=true; StopOwned(server,true); StopOwned(importer,false); };
    }
    Button AddButton(string text,int x,int y,EventHandler action) {
        var b=new Button {Text=text,Location=new Point(x,y),Size=new Size(152,38)};b.Click+=action;Controls.Add(b);return b;
    }
    void UI(Action action) { if(!closing && IsHandleCreated) BeginInvoke(action); }
    void EnsureEnv() {
        if (!File.Exists(env)) File.Copy(Path.Combine(app,".env.example"),env);
    }
    void OpenSettings(object sender,EventArgs args) {
        try { EnsureEnv(); Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"System32","notepad.exe"),"\""+env+"\"") {UseShellExecute=false}); }
        catch { MessageBox.Show("無法開啟設定，請以文字編輯器開啟執行檔旁的 .env。",Text); }
    }
    Process NewProcess(string script) {
        EnsureEnv();
        if(!File.Exists(node) || !File.Exists(Path.Combine(app,"node_modules","express","package.json"))) throw new InvalidOperationException();
        var info=new ProcessStartInfo(node,"\""+Path.Combine(app,"scripts",script)+"\"") { WorkingDirectory=app, UseShellExecute=false, CreateNoWindow=true, RedirectStandardOutput=true, RedirectStandardError=true, RedirectStandardInput=true };
        info.EnvironmentVariables["RAG_ENV_FILE"]=env;
        // The selected .env owns application configuration, not unrelated parent-shell settings.
        foreach(string key in new[]{"OPENAI_API_KEY","OPENAI_EMBEDDING_MODEL","OPENAI_CHAT_MODEL","RAG_STORE","RAG_INDEX_PATH","RAG_KNOWLEDGE_DIR","RAG_MIN_SCORE","RAG_TOP_K","PINECONE_API_KEY","PINECONE_INDEX","PINECONE_NAMESPACE","PORT"}) info.EnvironmentVariables.Remove(key);
        return new Process {StartInfo=info,EnableRaisingEvents=true};
    }
    void StartServer(object sender,EventArgs args) {
        if(server!=null) return;
        try {
            server=NewProcess("demo-server.js"); var owned=server;
            owned.OutputDataReceived+=(s,e)=>{
                if(e.Data==null || !e.Data.StartsWith("DEMO_READY:")) return;
                Uri parsed;
                if(!Uri.TryCreate(e.Data.Substring(11),UriKind.Absolute,out parsed) || parsed.Scheme!="http" || parsed.Host!="127.0.0.1")return;
                UI(()=>{url=parsed.AbsoluteUri;status.Text="展示已啟動，僅供本機使用。";open.Enabled=true;OpenBrowser();});
            };
            owned.ErrorDataReceived+=(s,e)=>{}; // Never surface raw process output or credentials.
            owned.Exited+=(s,e)=>UI(()=>{if(server==owned){server=null;start.Enabled=true;stop.Enabled=false;open.Enabled=false;status.Text="展示已停止。若啟動失敗，請檢查設定與安裝檔案。";}owned.Dispose();});
            owned.Start();owned.BeginOutputReadLine();owned.BeginErrorReadLine();start.Enabled=false;stop.Enabled=true;status.Text="正在啟動本機展示…";
        } catch { server=null;MessageBox.Show("啟動失敗。請完整解壓可攜版；原始碼版本需先安裝 Node.js 並執行 npm ci --ignore-scripts。",Text); }
    }
    void Import(object sender,EventArgs args) {
        if(importer!=null)return;
        if(MessageBox.Show("將 knowledge/demo 知識文字送至 OpenAI 產生向量；Pinecone 模式也會上傳文字及向量到你的 Pinecone。會使用你自己的 API 額度。繼續？",Text,MessageBoxButtons.YesNo)!=DialogResult.Yes)return;
        try {
            importer=NewProcess("ingest.js");var owned=importer;
            owned.OutputDataReceived+=(s,e)=>{};owned.ErrorDataReceived+=(s,e)=>{};
            owned.Exited+=(s,e)=>{int code=owned.ExitCode;UI(()=>{importer=null;ingest.Enabled=true;status.Text=code==0?"知識匯入成功，可以啟動展示。":"匯入未完成，請檢查金鑰、索引設定與網路。";owned.Dispose();});};
            owned.Start();owned.BeginOutputReadLine();owned.BeginErrorReadLine();ingest.Enabled=false;status.Text="正在匯入知識，請稍候…";
        } catch {importer=null;MessageBox.Show("無法啟動匯入，請檢查可攜版檔案是否完整。",Text);}
    }
    void OpenBrowser() { try {if(url!=null)Process.Start(new ProcessStartInfo(url){UseShellExecute=true});}catch{status.Text="請在瀏覽器開啟："+url;} }
    static void StopOwned(Process p,bool graceful) {
        if(p==null)return;
        try {if(p.HasExited)return;if(graceful){p.StandardInput.WriteLine("STOP");p.StandardInput.Flush();if(p.WaitForExit(2000))return;}p.Kill();}catch{}
    }
    void StopServer(object sender,EventArgs args) {StopOwned(server,true);}
}
