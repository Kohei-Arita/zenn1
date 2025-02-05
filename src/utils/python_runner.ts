import { spawn } from 'child_process';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

interface PythonResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function runPythonScript(
  scriptPath: string,
  functionName: string,
  args: any[]
): Promise<PythonResponse> {
  const tempFiles: string[] = [];

  // 大きなバイナリデータを一時ファイルに保存
  const processedArgs = args.map((arg) => {
    if (arg instanceof Buffer || (arg instanceof Uint8Array)) {
      const tempPath = join(tmpdir(), `${uuidv4()}.tmp`);
      writeFileSync(tempPath, arg);
      tempFiles.push(tempPath);
      return { __temp_file__: tempPath };
    }
    return arg;
  });

  return new Promise((resolve, reject) => {
    // Python実行コマンドの準備
    const pythonProcess = spawn('python3', [
      '-c',
      `
import sys
import json
import base64
sys.path.append('${join(process.cwd(), 'src/utils')}')
from ${scriptPath} import *

def load_temp_file(arg):
    if isinstance(arg, dict) and '__temp_file__' in arg:
        with open(arg['__temp_file__'], 'rb') as f:
            return f.read()
    return arg

try:
    # 引数の処理
    args = json.loads('${JSON.stringify(processedArgs)}')
    args = [load_temp_file(arg) for arg in args]
    
    # 関数の実行
    result = ${functionName}(*args)
    
    # バイナリデータの場合はbase64エンコード
    if isinstance(result, bytes):
        result = base64.b64encode(result).decode('utf-8')
    
    # 結果の出力
    print(json.dumps({'success': True, 'data': result}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
      `
    ]);

    let outputData = '';
    let errorData = '';

    // 標準出力の処理
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    // エラー出力の処理
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    // プロセス終了時の処理
    pythonProcess.on('close', (code) => {
      // 一時ファイルの削除
      tempFiles.forEach((file) => {
        try {
          unlinkSync(file);
        } catch (error) {
          console.error(`Failed to delete temp file ${file}:`, error);
        }
      });

      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}\n${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(outputData);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${outputData}\n${errorData}`));
      }
    });
  });
}
