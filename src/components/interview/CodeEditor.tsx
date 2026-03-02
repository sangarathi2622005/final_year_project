import { useEffect, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { supabase } from '@/integrations/supabase/client';
import { CodeSession } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, RotateCcw, Copy, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  interviewId: string;
  readOnly?: boolean;
}

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'typescript', label: 'TypeScript' },
];

const DEFAULT_CODE: Record<string, string> = {
  javascript: `// Welcome to the coding interview!
// Write your solution below

function solution(input) {
  // Your code here
  
}

// Test your solution
console.log(solution([1, 2, 3]));
`,
  python: `# Welcome to the coding interview!
# Write your solution below

def solution(input):
    # Your code here
    pass

# Test your solution
print(solution([1, 2, 3]))
`,
  java: `// Welcome to the coding interview!
// Write your solution below

public class Solution {
    public static void main(String[] args) {
        // Test your solution
        System.out.println(solution(new int[]{1, 2, 3}));
    }
    
    public static int solution(int[] input) {
        // Your code here
        return 0;
    }
}
`,
  typescript: `// Welcome to the coding interview!
// Write your solution below

function solution(input: number[]): number {
  // Your code here
  return 0;
}

// Test your solution
console.log(solution([1, 2, 3]));
`,
};

export function CodeEditor({ interviewId, readOnly = false }: CodeEditorProps) {
  const [codeSession, setCodeSession] = useState<CodeSession | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    fetchOrCreateSession();
  }, [interviewId]);

  useEffect(() => {
    if (!codeSession) return;

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`code-session-${codeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'code_sessions',
          filter: `id=eq.${codeSession.id}`,
        },
        (payload) => {
          const newData = payload.new as CodeSession;
          // Only update if change came from someone else
          if (newData.updated_at !== lastUpdate) {
            setCode(newData.code_content);
            setLanguage(newData.language);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [codeSession, lastUpdate]);

  const fetchOrCreateSession = async () => {
    try {
      // Try to fetch existing session
      const { data: existing, error: fetchError } = await supabase
        .from('code_sessions')
        .select('*')
        .eq('interview_id', interviewId)
        .single();

      if (existing) {
        setCodeSession(existing as CodeSession);
        setCode(existing.code_content);
        setLanguage(existing.language);
        return;
      }

      // Create new session
      const { data: newSession, error: createError } = await supabase
        .from('code_sessions')
        .insert({
          interview_id: interviewId,
          language: 'javascript',
          code_content: DEFAULT_CODE.javascript,
        })
        .select()
        .single();

      if (createError) throw createError;
      
      setCodeSession(newSession as CodeSession);
      setCode(newSession.code_content);
      setLanguage(newSession.language);
    } catch (error) {
      console.error('Error with code session:', error);
    }
  };

  const handleCodeChange = useCallback(
    async (value: string | undefined) => {
      if (!value || !codeSession || readOnly) return;
      
      setCode(value);
      
      // Debounce the database update
      const updateTime = new Date().toISOString();
      setLastUpdate(updateTime);
      
      try {
        await supabase
          .from('code_sessions')
          .update({ 
            code_content: value,
            updated_at: updateTime,
          })
          .eq('id', codeSession.id);
      } catch (error) {
        console.error('Error saving code:', error);
      }
    },
    [codeSession, readOnly]
  );

  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage);
    
    // If code is empty or default, set default for new language
    if (!code.trim() || Object.values(DEFAULT_CODE).includes(code)) {
      setCode(DEFAULT_CODE[newLanguage] || '');
    }
    
    if (codeSession) {
      try {
        await supabase
          .from('code_sessions')
          .update({ 
            language: newLanguage,
            code_content: DEFAULT_CODE[newLanguage] || code,
          })
          .eq('id', codeSession.id);
      } catch (error) {
        console.error('Error updating language:', error);
      }
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    setOutput('Running...\n');

    // Simulate code execution (in production, this would call a secure sandbox)
    setTimeout(() => {
      try {
        if (language === 'javascript') {
          // Very basic JS execution simulation
          const logs: string[] = [];
          const mockConsole = {
            log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
          };
          
          try {
            // eslint-disable-next-line no-new-func
            const fn = new Function('console', code);
            fn(mockConsole);
            setOutput(logs.join('\n') || 'Code executed successfully (no output)');
          } catch (e) {
            setOutput(`Error: ${(e as Error).message}`);
          }
        } else {
          setOutput(`[${language.toUpperCase()}] Code execution would happen in a secure sandbox.\n\nFor this demo, only JavaScript runs locally.`);
        }
      } catch (error) {
        setOutput(`Error: ${(error as Error).message}`);
      }
      setIsRunning(false);
    }, 500);
  };

  const handleReset = () => {
    setCode(DEFAULT_CODE[language] || '');
    setOutput('');
    handleCodeChange(DEFAULT_CODE[language] || '');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: 'Code copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-editor-bg rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/20 bg-editor-line/50">
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-36 h-8 bg-editor-bg border-border/30 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={handleRun}
            disabled={isRunning}
            className="gap-1"
          >
            <Play className="h-4 w-4" />
            Run
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'JetBrains Mono, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
          }}
        />
      </div>

      {/* Output Panel */}
      <div className="h-32 border-t border-border/20">
        <div className="px-4 py-2 bg-editor-line/50 text-xs font-medium text-muted-foreground">
          Output
        </div>
        <pre className={cn(
          "h-[calc(100%-28px)] p-4 overflow-auto text-sm font-mono",
          output.includes('Error') ? 'text-destructive' : 'text-green-400'
        )}>
          {output || 'Click "Run" to execute your code'}
        </pre>
      </div>
    </div>
  );
}
