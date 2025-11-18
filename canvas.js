window.addEventListener('load', () => {
    // --- 1. CORE CONSTANTS & INITIAL SETUP ---
    const totalTasks = 3;
    const taskPrompts = ["Draw a House", "Draw a Sun", "Draw a Boy"];
    let currentTask = 0;
    
    // Store all user and drawing data
    const userData = {
        name: '',
        age: '',
        profile: '',
        drawings: []
    };

    // Drawing state variables
    let canvas = null;
    let ctx = null;
    let painting = false;
    let strokes = [];
    let lastTime = null;
    let penLifts = 0;
    
    // UI elements to be reused or controlled
    let taskCounter = null;
    let nextBtn = null;
    let submitBtn = null; 
    let buttonContainer = null;

    // --- 2. DATA PROCESSING FUNCTIONS ---

    // Calculate Average Pressure for a single stroke
    function calculateAvgPressure(stroke) {
        if (stroke.points.length === 0) return 0;
        const totalPressure = stroke.points.reduce((sum, p) => sum + (p.pressure || 0), 0);
        return totalPressure / stroke.points.length;
    }

    // Format stroke data for readable display (NOW INCLUDES AVG PRESSURE)
    function formatStrokeData(data) {
        let output = "--- USER DATA ---\n";
        output += `Name: ${userData.name}\n`;
        output += `Age: ${userData.age}\n`;
        output += `Development Profile: ${userData.profile}\n\n`;
        output += "--- DRAWING DATA ---\n";
        
        data.forEach((drawing, dIndex) => {
            // Display overall drawing metrics (including calculated avg pressure)
            output += `\nDrawing ${dIndex + 1}: ${taskPrompts[dIndex]}\n`;
            output += `Total Strokes: ${drawing.strokeData.strokes.length}\n`;
            output += `Total Points: ${drawing.strokeData.totalPoints}\n`;
            output += `Average Pressure: ${drawing.strokeData.avgPressure.toFixed(3)}\n`; // Display Avg Pressure
            output += "----------------------------------------\n";
            
            drawing.strokeData.strokes.forEach((s, sIndex) => {
                output += `  Stroke ${sIndex + 1}:\n`;
                output += `    Duration: ${s.duration} ms\n`;
                output += `    Avg Speed: ${s.avgSpeed.toFixed(2)} px/ms\n`;
                output += `    Points Recorded: ${s.points.length}\n`;
                output += `    Stroke Avg Pressure: ${calculateAvgPressure(s).toFixed(3)}\n`; // Display Stroke Avg Pressure
            });
            output += "\n";
        });
        return output;
    }

    function downloadFile(data, filename, type) {
        const file = new Blob([data], { type: type });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    
    function downloadImage(dataURL, filename) {
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // Return a copy of stroke data and calculate aggregate metrics
    window.getStrokeData = () => {
        const data = JSON.parse(JSON.stringify(strokes));
        const totalPoints = data.reduce((sum, s) => sum + s.points.length, 0);
        
        // Calculate the overall average pressure for the entire drawing
        let totalPressureSum = 0;
        data.forEach(s => {
            totalPressureSum += s.points.reduce((sum, p) => sum + (p.pressure || 0), 0);
        });
        const avgPressure = totalPoints > 0 ? totalPressureSum / totalPoints : 0;
        
        return { strokes: data, penLifts, totalPoints, avgPressure };
    };


    // --- 3. DRAWING & METRIC LOGIC (Unchanged) ---

    function startPosition(e) {
        if (e.pointerType === 'pen' || e.button === 0) { 
            painting = true;
            lastTime = Date.now();
            strokes.push({ points: [], duration: 0, avgSpeed: 0, totalDistance: 0 });
            draw(e);
        }
    }

    function endPosition() {
        if (!painting) return;
        painting = false;
        penLifts++;

        const s = strokes[strokes.length - 1];
        if (s.points.length > 1) {
            s.duration = s.points[s.points.length - 1].tTotal;
            
            const speeds = [];
            let totalDist = 0;
            
            for (let i = 1; i < s.points.length; i++) {
                const p1 = s.points[i - 1];
                const p2 = s.points[i];
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                totalDist += dist;
                
                const dt = p2.dt;
                if (dt > 0) speeds.push(dist / dt);
            }
            
            s.avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
            s.totalDistance = totalDist;
        }

        ctx.beginPath();
    }

    function draw(e) {
        if (!painting) return;
        
        e.preventDefault(); 
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // **e.pressure is the key metric for Apple Pencil.** Defaulting to 1 if no pressure detected 
        // helps ensure a visible line, but using 0 is safer for data integrity. 
        // We'll rely on the pressure property provided by the browser.
        const pressure = e.pressure || 0.0; 
        const now = Date.now();

        const dt = now - lastTime;
        
        const lastStroke = strokes[strokes.length - 1];
        const tTotal = lastStroke.points.length > 0
            ? lastStroke.points[lastStroke.points.length - 1].tTotal + dt
            : 0;

        // Record pressure data
        lastStroke.points.push({ x, y, pressure, dt, tTotal });
        lastTime = now;

        // Drawing Visualization (Line width scaled by pressure for visual feedback)
        ctx.lineWidth = pressure > 0 ? pressure * 15 + 5 : 5;
        ctx.strokeStyle = "black";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        ctx.lineTo(x, y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    function setupDrawingListeners() {
        canvas.addEventListener("pointerdown", startPosition);
        canvas.addEventListener("pointerup", endPosition);
        canvas.addEventListener("pointerout", endPosition);
        canvas.addEventListener("pointermove", draw);
    }
    
    function removeDrawingListeners() {
        canvas.removeEventListener("pointerdown", startPosition);
        canvas.removeEventListener("pointerup", endPosition);
        canvas.removeEventListener("pointerout", endPosition);
        canvas.removeEventListener("pointermove", draw);
    }


    // --- 4. UI FLOW MANAGEMENT ---

    function updateTaskCounter() {
        taskCounter.textContent = `Drawing Task ${currentTask + 1} of ${totalTasks} — ${taskPrompts[currentTask]}`;
    }

    function saveCurrentDrawing() {
        endPosition(); 
        
        if (strokes.length > 0) {
            const strokeData = getStrokeData();
            const pngData = canvas.toDataURL("image/png");

            userData.drawings.push({
                task: taskPrompts[currentTask],
                strokeData,
                png: pngData
            });
        }

        strokes = [];
        penLifts = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function handleNextTask() {
        saveCurrentDrawing();
        currentTask++;

        // Check if we are moving to the final task (index 2: "Draw a Boy")
        if (currentTask === totalTasks - 1) { 
            
            // A. Remove the "Next" button
            if (nextBtn) {
                nextBtn.style.display = "none";
                nextBtn.remove();
            }

            // B. Create and display the "Submit" button
            submitBtn = document.createElement("button");
            submitBtn.textContent = "Submit";
            submitBtn.style.cssText = `
                font-size: 18px;
                padding: 10px 18px;
                border-radius: 8px;
                cursor: pointer;
                background-color: #28a745;
                color: white;
                border: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `; 
            
            submitBtn.onclick = handleSubmit;
            buttonContainer.appendChild(submitBtn);
            
            // C. Update the task counter to the final prompt
            updateTaskCounter();

        } else if (currentTask < totalTasks) {
            // If there are more tasks (Task 1 or Task 2), update the prompt
            updateTaskCounter();
        } 
    }

    function handleSubmit() {
        saveCurrentDrawing();
        removeDrawingListeners();
        
        // Hide UI elements
        canvas.style.display = 'none';
        taskCounter.style.display = 'none';
        buttonContainer.style.display = 'none';
        
        showSubmissionPopup();
    }
    
    // --- 5. INITIAL START SCREEN UI ---

    function createStartScreen() {
        // Apply CSS to body for better scaling on iPad
        document.body.style.cssText = `
            display: flex; justify-content: center; align-items: center; 
            min-height: 100vh; margin: 0; 
            font-family: sans-serif; font-size: 18px; /* Base font size increase */
        `;
        document.body.innerHTML = '';

        const formContainer = document.createElement('div');
        formContainer.style.cssText = `
            padding: 40px; border: 1px solid #ccc; border-radius: 12px;
            box-shadow: 0 6px 16px rgba(0,0,0,0.1); background: #f9f9f9;
            min-width: 350px;
        `;
        
        const title = document.createElement('h2');
        title.textContent = "Participant Information";
        title.style.textAlign = 'center';
        
        // Increased font size in form elements
        const nameInput = createFormElement('Name:', 'input', { type: 'text', id: 'nameInput' });
        
        const ageDropdown = createFormElement('Age (5-12):', 'select', { id: 'ageDropdown' });
        for (let i = 5; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            ageDropdown.querySelector('select').appendChild(option);
        }
        
        const profileDropdown = createFormElement('Development Profile:', 'select', { id: 'profileDropdown' });
        ['typical', 'delayed'].forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p.charAt(0).toUpperCase() + p.slice(1);
            profileDropdown.querySelector('select').appendChild(option);
        });

        const startBtn = document.createElement('button');
        startBtn.textContent = 'Start Drawing Task';
        startBtn.style.cssText = `
            margin-top: 25px; padding: 15px 24px; font-size: 20px;
            cursor: pointer; width: 100%; border-radius: 8px;
            background-color: #007bff; color: white; border: none;
        `;
        
        startBtn.onclick = () => {
            const name = document.getElementById('nameInput').value.trim();
            if (!name) {
                alert("Please enter a name to begin.");
                return;
            }
            
            userData.name = name;
            userData.age = document.getElementById('ageDropdown').value;
            userData.profile = document.getElementById('profileDropdown').value;
            
            initializeCanvasAndUI();
        };

        formContainer.appendChild(title);
        formContainer.appendChild(nameInput);
        formContainer.appendChild(ageDropdown);
        formContainer.appendChild(profileDropdown);
        formContainer.appendChild(startBtn);
        document.body.appendChild(formContainer);
    }
    
    function createFormElement(label, type, attrs = {}) {
        const div = document.createElement('div');
        div.style.marginBottom = '20px'; // Increased margin

        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.cssText = 'display: block; margin-bottom: 8px; font-weight: bold;';
        
        const inputEl = document.createElement(type);
        Object.assign(inputEl, attrs);
        inputEl.style.cssText = 'width: 100%; padding: 10px; box-sizing: border-box; border-radius: 6px; border: 1px solid #ccc; font-size: 18px;';

        div.appendChild(labelEl);
        div.appendChild(inputEl);
        return div;
    }

    // --- 6. CANVAS & TASK UI SETUP ---

    function initializeCanvasAndUI() {
        document.body.innerHTML = '';
        document.body.style.display = 'block';
        document.body.style.padding = '0';
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden';

        // 6a. Canvas Setup
        canvas = document.createElement("canvas");
        canvas.id = "canvas";
        document.body.appendChild(canvas);
        ctx = canvas.getContext("2d");

        canvas.height = window.innerHeight; 
        canvas.width = window.innerWidth;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        window.onresize = () => {
            canvas.height = window.innerHeight;
            canvas.width = window.innerWidth;
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        };

        // 6b. Task Counter (Prompt) - INCREASED FONT SIZE
        taskCounter = document.createElement("p");
        taskCounter.style.cssText = `
            font-size: 36px; /* Increased font size for iPad visibility */
            font-weight: bold;
            text-align: center;
            margin: 15px 0; /* Increased margin */
            color: #333;
            user-select: none;
        `;
        document.body.insertBefore(taskCounter, canvas);

        // 6c. Buttons Container (Top Right)
        buttonContainer = document.createElement("div");
        buttonContainer.style.cssText = `
            position: absolute;
            top: 25px; /* Moved down slightly */
            right: 25px; /* Moved in slightly */
            display: flex;
            flex-direction: row;
            gap: 15px; /* Increased gap */
            z-index: 100;
        `;
        document.body.appendChild(buttonContainer);

        // 6d. Next Button 
        nextBtn = document.createElement("button");
        nextBtn.textContent = "Next";
        nextBtn.style.cssText = `
            font-size: 20px; /* Increased font size */
            padding: 12px 20px; /* Increased padding */
            border-radius: 8px;
            cursor: pointer;
            background-color: #007bff;
            color: white;
            border: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        nextBtn.onclick = handleNextTask;
        buttonContainer.appendChild(nextBtn);

        // Start the first task
        updateTaskCounter();
        setupDrawingListeners();
    }
    
    // --- 7. FINAL SUBMISSION POPUP & DOWNLOAD (Minor Adjustments for Readability) ---
    
    function showSubmissionPopup() {
        const overlay = document.createElement("div");
        overlay.style.cssText = `
            position: fixed; left: 0; top: 0; width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
            background-color: rgba(0,0,0,0.6); z-index: 9999;
        `;

        const box = document.createElement("div");
        box.style.cssText = `
            background: #fff; padding: 30px 40px; border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25); text-align: center;
            position: relative; min-width: 400px;
        `;

        const headline = document.createElement("h3");
        headline.textContent = "Drawings Submitted Successfully!";
        headline.style.margin = "0 0 10px 0";
        headline.style.fontSize = "24px"; // Larger font

        const message = document.createElement("p");
        message.textContent = "Thank you for completing the drawing tasks. Data is ready for review and download.";
        message.style.margin = "0 0 25px 0";
        message.style.fontSize = "18px"; // Larger font

        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close";
        closeBtn.style.cssText = `padding: 10px 20px; font-size: 18px; cursor: pointer;`;
        closeBtn.onclick = () => overlay.remove();

        // View Data Button
        const viewDataBtn = document.createElement("button");
        viewDataBtn.textContent = "View Stroke Data";
        viewDataBtn.style.cssText = `
            position: absolute; bottom: 15px; right: 15px; font-size: 14px;
            padding: 8px 12px; cursor: pointer; border-radius: 6px; opacity: 0.8;
            background-color: #f0f0f0; border: 1px solid #ccc;
        `;

        viewDataBtn.onclick = () => showDataViewer();

        box.appendChild(headline);
        box.appendChild(message);
        box.appendChild(closeBtn);
        box.appendChild(viewDataBtn);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }
    
    function showDataViewer() {
        const dataOverlay = document.createElement("div");
        dataOverlay.style.cssText = `
            position: fixed; left: 0; top: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); display: flex; justify-content: center;
            align-items: center; z-index: 10000;
        `;

        const dataBox = document.createElement("div");
        dataBox.style.cssText = `
            background: #fff; padding: 30px; border-radius: 12px;
            width: 95%; max-width: 1200px; height: 95%;
            display: flex; flex-direction: column;
        `;
        
        // --- DATA VIEW AREA ---
        const dataViewArea = document.createElement('div');
        dataViewArea.style.cssText = `
            display: flex; flex-direction: row; flex-grow: 1; gap: 20px;
            margin-bottom: 20px; overflow: hidden;
        `;
        
        // 1. Text Data (Stroke Metrics)
        const textDataContainer = document.createElement('div');
        textDataContainer.style.cssText = `
            flex: 1; padding: 15px; border: 1px solid #eee; border-radius: 8px;
            overflow: auto; font-family: monospace; white-space: pre-wrap;
            font-size: 16px; /* Increased font size */
        `;
        const dataText = document.createElement("pre");
        dataText.textContent = formatStrokeData(userData.drawings);
        textDataContainer.appendChild(dataText);
        
        // 2. Image Thumbnails
        const imageGallery = document.createElement('div');
        imageGallery.style.cssText = `
            width: 350px; padding: 15px; border: 1px solid #eee; border-radius: 8px;
            overflow-y: auto; display: flex; flex-direction: column; gap: 20px;
            align-items: center;
        `;
        
        userData.drawings.forEach((drawing, index) => {
            const imgContainer = document.createElement('div');
            imgContainer.style.textAlign = 'center';
            
            const imgLabel = document.createElement('h4');
            imgLabel.textContent = `${index + 1}. ${drawing.task}`;
            imgLabel.style.margin = '0 0 8px 0';
            imgLabel.style.fontSize = '18px';
            
            const img = document.createElement('img');
            img.src = drawing.png;
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.border = '1px solid #ccc';
            
            imgContainer.appendChild(imgLabel);
            imgContainer.appendChild(img);
            imageGallery.appendChild(imgContainer);
        });
        
        dataViewArea.appendChild(textDataContainer);
        dataViewArea.appendChild(imageGallery);


        // --- DOWNLOAD & CLOSE BUTTONS ---
        const controlContainer = document.createElement('div');
        controlContainer.style.cssText = `
            display: flex; justify-content: space-between; align-items: center;
            margin-top: 15px;
        `;
        
        // Download Button
        const downloadAllBtn = document.createElement("button");
        downloadAllBtn.textContent = "Download All Data (.json & PNGs)";
        downloadAllBtn.style.cssText = `
            padding: 12px 20px; font-size: 18px; cursor: pointer;
            background-color: #28a745; color: white; border: none; border-radius: 8px;
        `;
        downloadAllBtn.onclick = () => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const baseFilename = `${userData.name}-${userData.profile}-${timestamp}`;
            
            // 1. Download JSON data
            const jsonData = JSON.stringify(userData, null, 2);
            downloadFile(jsonData, `${baseFilename}-data.json`, 'application/json');
            
            // 2. Download PNGs
            userData.drawings.forEach((drawing, index) => {
                const drawingName = drawing.task.replace(/ /g, '_');
                downloadImage(drawing.png, `${baseFilename}-${drawingName}-${index + 1}.png`);
            });
        };
        
        // Close Button
        const closeDataBtn = document.createElement("button");
        closeDataBtn.textContent = "Close Data Viewer";
        closeDataBtn.style.cssText = `
            padding: 12px 20px; font-size: 18px; cursor: pointer;
            background-color: #dc3545; color: white; border: none; border-radius: 8px;
        `;
        closeDataBtn.onclick = () => dataOverlay.remove();

        controlContainer.appendChild(downloadAllBtn);
        controlContainer.appendChild(closeDataBtn);

        // Assemble Data Box
        dataBox.appendChild(dataViewArea);
        dataBox.appendChild(controlContainer);
        dataOverlay.appendChild(dataBox);
        document.body.appendChild(dataOverlay);
    }

    // Start the application with the initial screen
    createStartScreen();
});