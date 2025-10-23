// runPython.js
const { spawn } = require('child_process');

function runPythonScript(inputData) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [
      'mcq_generator.py',
      JSON.stringify(inputData),
    ]);

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
runPythonScript({
  bootcampid: 803,
  difficulty: 'Medium',
  topics: { Arrays: 4, Loops: 3 },
  audience: 'Assessment for AFE cohort, semester 2 and 3 CSE',
})
  .then((result) => console.log('Python Output:', result))
  .catch((err) => console.error('Error:', err));
