// runPython.js
const { spawn } = require('child_process');

function runPythonScript(inputData) {
  return new Promise((resolve, reject) => {
    const python = spawn('/home/ravip/Documents/navgurukul/mcq-generator/.venv/bin/python', ['/home/ravip/Documents/navgurukul/mcq-generator/mcq_generator.py', JSON.stringify(inputData)]);

    let output = '';
    let error = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (err) {
          reject(new Error('Failed to parse Python output'));
        }
      } else {
        reject(new Error(`Python error: ${error}`));
      }
    });
  });
}

// Example usage
runPythonScript({ name: 'Ravi' })
  .then((result) => console.log('Python Output:', result))
  .catch((err) => console.error('Error:', err));