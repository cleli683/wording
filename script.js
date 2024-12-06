let wordList = [];
let filteredWords = [];
let currentIndex = 0;
let mistakesList = [];

// 在文件开头添加初始化函数
function initializeApp() {
    // 从本地存储加载单词列表
    const savedWords = loadWordsFromStorage();
    if (savedWords.length > 0) {
        wordList = savedWords;
        filteredWords = [...wordList];
        updateFilterOptions();
        updateWordBank();
    }
    
    // 加载错题本
    loadMistakesFromStorage();
}

// 加载Excel文件
function loadExcel() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请先选择Excel文件');
        return;
    }

    // 检查文件类型
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        alert('请选择正确的Excel文件（.xlsx或.xls格式）');
        return;
    }

    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            if (!workbook.SheetNames.length) {
                alert('Excel文件似乎是空的');
                return;
            }

            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
                header: ['word', 'meaning', 'note', 'source', 'date'],
                defval: '' // 设置空单元格的默认值
            });
            
            if (jsonData.length <= 1) {
                alert('Excel文件中没有找到数据');
                return;
            }

            // 移除标题行并格式化日期
            wordList = jsonData.slice(1).map(item => {
                // 确保word和meaning字段不为空
                if (!item.word || !item.meaning) {
                    console.warn('发现空的单词或释义:', item);
                }

                // 处理日期
                if (item.date) {
                    try {
                        let dateValue = item.date;
                        if (typeof dateValue === 'number') {
                            // Excel数字日期格式
                            const dateObj = new Date((dateValue - 25569) * 86400 * 1000);
                            item.date = dateObj.toISOString().split('T')[0];
                        } else if (typeof dateValue === 'string') {
                            // 字符串日期格式
                            const dateObj = new Date(dateValue);
                            if (!isNaN(dateObj.getTime())) {
                                item.date = dateObj.toISOString().split('T')[0];
                            }
                        }
                    } catch (error) {
                        console.warn('日期格式转换失败:', item.date);
                        item.date = ''; // 如果日期转换失败，设置为空字符串
                    }
                }
                return item;
            });

            // 过滤掉没有单词或释义的数据
            wordList = wordList.filter(item => item.word && item.meaning);
            
            if (wordList.length === 0) {
                alert('没有找到有效的单词数据');
                return;
            }

            // 获取已存储的单词列表
            const savedWords = loadWordsFromStorage();
            
            // 合并新单词和已存储的单词，避免重复
            const newWords = wordList.filter(newWord => 
                !savedWords.some(savedWord => 
                    savedWord.word === newWord.word && 
                    savedWord.meaning === newWord.meaning &&
                    savedWord.source === newWord.source
                )
            );
            
            // 合并单词列表
            wordList = [...savedWords, ...newWords];
            
            // 保存到本地存储
            saveWordsToStorage(wordList);
            
            filteredWords = [...wordList];
            updateFilterOptions();
            updateWordBank();
            showWord(0);
            
            alert(`成功导入 ${newWords.length} 个新单词，当前共有 ${wordList.length} 个单词`);
            
        } catch (error) {
            console.error('处理Excel文件时出错:', error);
            alert('处理Excel文件时出错，请确保文件格式正确');
        }
    };

    reader.onerror = function(error) {
        console.error('读取文件时出错:', error);
        alert('读取文件时出错，请重试');
    };

    try {
        reader.readAsArrayBuffer(file);
    } catch (error) {
        console.error('读取文件时出错:', error);
        alert('读取文件时出错，请重试');
    }
}

// 更新筛选选项
function updateFilterOptions() {
    // 更新来源筛选
    const sources = [...new Set(wordList.map(item => String(item.source)))];
    const sourceFilter = document.getElementById('sourceFilter');
    sourceFilter.innerHTML = '<option value="">按来源筛选</option>';
    sources.sort().forEach(source => {
        sourceFilter.innerHTML += `<option value="${source}">${source}</option>`;
    });

    // 更新日期筛选
    const dates = [...new Set(wordList.map(item => item.date))];
    const dateFilter = document.getElementById('dateFilter');
    dateFilter.innerHTML = '<option value="">按日期筛选</option>';
    dates.forEach(date => {
        dateFilter.innerHTML += `<option value="${date}">${date}</option>`;
    });

    // 更新首字母筛选
    const letters = [...new Set(wordList.map(item => item.word.charAt(0).toUpperCase()))].sort();
    const letterFilter = document.getElementById('letterFilter');
    letterFilter.innerHTML = '<option value="">按首字母筛选</option>';
    letters.forEach(letter => {
        letterFilter.innerHTML += `<option value="${letter}">${letter}</option>`;
    });
}

// 应用筛选
function applyFilters() {
    const source = document.getElementById('sourceFilter').value;
    const date = document.getElementById('dateFilter').value;
    const letter = document.getElementById('letterFilter').value;

    filteredWords = wordList.filter(word => {
        const sourceMatch = !source || String(word.source) === String(source);
        const dateMatch = !date || word.date === date;
        const letterMatch = !letter || (word.word && word.word.charAt(0).toUpperCase() === letter);
        return sourceMatch && dateMatch && letterMatch;
    });

    currentIndex = 0;
    if (filteredWords.length > 0) {
        showWord(0);
    } else {
        document.getElementById('currentWord').textContent = '没有匹配的单词';
    }
}

// 显示单词
function showWord(index) {
    if (filteredWords.length === 0) {
        document.getElementById('currentWord').textContent = '没有匹配的单词';
        return;
    }

    if (index >= filteredWords.length) {
        showCompletionMessage();
        return;
    }

    const word = filteredWords[index];
    document.getElementById('currentWord').textContent = word.word;
    document.getElementById('meaning').textContent = `释义：${word.meaning}`;
    document.getElementById('note').textContent = `备注：${word.note || '无'}`;
    document.getElementById('source').textContent = `来源：${word.source}`;
    document.getElementById('date').textContent = `日期：${word.date}`;

    // 添加进度显示
    const progress = `进度：${index + 1}/${filteredWords.length}`;
    document.getElementById('progress').textContent = progress;
    
    // 更新进度条
    const percentage = ((index + 1) / filteredWords.length) * 100;
    document.getElementById('progress-bar').style.width = `${percentage}%`;

    // 确保释义始终隐藏
    document.getElementById('word-details').classList.add('hidden');
    document.querySelector('.toggle-btn').textContent = '显示释义';
}

// 切换释义显示
function toggleMeaning() {
    const detailsElement = document.getElementById('word-details');
    const toggleButton = document.querySelector('.toggle-btn');
    
    if (detailsElement.classList.contains('hidden')) {
        detailsElement.classList.remove('hidden');
        toggleButton.textContent = '隐藏释义';
    } else {
        detailsElement.classList.add('hidden');
        toggleButton.textContent = '显示释义';
    }
}

// 下一个单词
function nextWord() {
    currentIndex++;
    if (currentIndex >= filteredWords.length) {
        // 复习完成
        showCompletionMessage();
    } else {
        showWord(currentIndex);
    }
}

// 添加页面切换功能
function switchPage(page) {
    // 隐藏所有页面
    document.querySelector('.word-section').style.display = 'none';
    document.getElementById('wordbank-section').style.display = 'none';
    document.getElementById('mistakes-section').style.display = 'none';
    
    // 移除所有导航按钮的active类
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // 显示选中的���面
    switch(page) {
        case 'review':
            document.querySelector('.word-section').style.display = 'block';
            document.querySelector('.nav-btn:nth-child(1)').classList.add('active');
            // 重置复习页面状态
            document.getElementById('review-start').style.display = 'block';
            document.getElementById('filter-section').style.display = 'none';
            document.getElementById('word-card').style.display = 'none';
            // 重置单词卡片内容为新的HTML结构
            document.getElementById('word-card').innerHTML = `
                <div class="card-header">
                    <div class="progress-container">
                        <div id="progress-bar" class="progress-bar"></div>
                    </div>
                    <p id="progress" class="progress-text">进度：0/0</p>
                    <div class="exit-button">
                        <button onclick="exitReview()">退出复习</button>
                    </div>
                </div>
                
                <div class="card-content">
                    <h2 id="currentWord" class="word-text">请导入单词</h2>
                    <div class="word-details hidden" id="word-details">
                        <p id="meaning">释义将在这里显示</p>
                        <p id="note">备注将在这里显示</p>
                        <p id="source">来源将在这里显示</p>
                        <p id="date">日期将在这里显示</p>
                    </div>
                </div>
                
                <div class="button-group">
                    <button onclick="handleKnown()" class="known-btn">认识</button>
                    <button onclick="handleUnknown()" class="unknown-btn">不认识</button>
                    <button onclick="toggleMeaning()" class="toggle-btn">显示释义</button>
                </div>
            `;
            break;
        case 'wordbank':
            document.getElementById('wordbank-section').style.display = 'block';
            document.querySelector('.nav-btn:nth-child(2)').classList.add('active');
            updateWordbankFilters();
            updateWordBank();
            break;
        case 'mistakes':
            document.getElementById('mistakes-section').style.display = 'block';
            document.querySelector('.nav-btn:nth-child(3)').classList.add('active');
            updateMistakesFilters();
            updateMistakesTable();
            break;
    }
}

// 更新单词库显示
function updateWordBank() {
    const tbody = document.querySelector('#wordbank-table tbody');
    tbody.innerHTML = '';
    
    wordList.forEach(word => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${word.word}</td>
            <td>${word.meaning}</td>
            <td>${word.note || ''}</td>
            <td>${word.source}</td>
            <td>${word.date}</td>
        `;
        tbody.appendChild(row);
    });
}

// 添加到错题本
function addToMistakes(word) {
    const existingWord = mistakesList.find(item => item.word === word.word);
    if (existingWord) {
        existingWord.count = (existingWord.count || 1) + 1;
    } else {
        mistakesList.push({
            ...word,
            count: 1
        });
    }
    updateMistakesTable();
    saveMistakesToStorage();
}

// 从错题本中移除
function removeFromMistakes(word) {
    mistakesList = mistakesList.filter(item => item.word !== word);
    updateMistakesTable();
    saveMistakesToStorage();
}

// 更新错题本显示
function updateMistakesTable() {
    const tbody = document.querySelector('#mistakes-table tbody');
    tbody.innerHTML = '';
    
    mistakesList.forEach(word => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${word.word}</td>
            <td>${word.meaning}</td>
            <td>${word.note || ''}</td>
            <td>${word.source}</td>
            <td>${word.date}</td>
            <td>${word.count || 1}</td>
            <td>
                <button onclick="removeFromMistakes('${word.word}')">移除</button>
                <button onclick="reviewMistake('${word.word}')">复习</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// 保存题本到本地存储
function saveMistakesToStorage() {
    localStorage.setItem('mistakes', JSON.stringify(mistakesList));
}

// 从本地存储加载��题本
function loadMistakesFromStorage() {
    const saved = localStorage.getItem('mistakes');
    if (saved) {
        mistakesList = JSON.parse(saved);
        updateMistakesTable();
    }
}

// 添加认识按钮处理函数
function handleKnown() {
    nextWord();
}

// 修改不认识按钮处理函数
function handleUnknown() {
    const word = filteredWords[currentIndex];
    addToMistakes(word);
    nextWord(); // 直接跳到下一个单词
}

// 添加复习错题功能
function reviewMistake(word) {
    const mistakeWord = mistakesList.find(item => item.word === word);
    if (mistakeWord) {
        filteredWords = [mistakeWord];
        currentIndex = 0;
        switchPage('review');
        showWord(0);
    }
}

// 显示筛选界面
function showFilterAndStart() {
    // 重置所有状态
    document.getElementById('review-start').style.display = 'none';
    document.getElementById('filter-section').style.display = 'block';
    document.getElementById('word-card').style.display = 'none';
    
    // 重置筛选选项
    document.getElementById('sourceFilter').value = '';
    document.getElementById('dateFilter').value = '';
    document.getElementById('letterFilter').value = '';
    
    // 重置进度和筛选结果
    currentIndex = 0;
    filteredWords = [...wordList];
    
    // 更新筛选选项
    updateFilterOptions();
}

// 开始复习
function startReview() {
    applyFilters(); // 应用筛选
    if (filteredWords.length > 0) {
        // 重置单词卡片内容，使用新的HTML结构
        document.getElementById('word-card').innerHTML = `
            <div class="card-header">
                <div class="progress-container">
                    <div id="progress-bar" class="progress-bar"></div>
                </div>
                <p id="progress" class="progress-text">进度：0/0</p>
                <div class="exit-button">
                    <button onclick="exitReview()">退出复习</button>
                </div>
            </div>
            
            <div class="card-content">
                <h2 id="currentWord" class="word-text">请导入单词</h2>
                <div class="word-details hidden" id="word-details">
                    <p id="meaning">释义将在这里显示</p>
                    <p id="note">备注将在这里显示</p>
                    <p id="source">来源将在这里显示</p>
                    <p id="date">日期将在这里显示</p>
                </div>
            </div>
            
            <div class="button-group">
                <button onclick="handleKnown()" class="known-btn">认识</button>
                <button onclick="handleUnknown()" class="unknown-btn">不认识</button>
                <button onclick="toggleMeaning()" class="toggle-btn">显示释义</button>
            </div>
        `;
        
        document.getElementById('filter-section').style.display = 'none';
        document.getElementById('word-card').style.display = 'block';
        currentIndex = 0;
        showWord(0);
        alert(`筛选出 ${filteredWords.length} 个单词开始复习`);
    } else {
        alert('没有找到符合条件的单词');
    }
}

// 更新单词库筛选选项
function updateWordbankFilters() {
    updateFilterOptionsForElement('wordbank-sourceFilter', 'wordbank-dateFilter', 'wordbank-letterFilter');
}

// 更新错题本筛选选项
function updateMistakesFilters() {
    const sources = [...new Set(mistakesList.map(item => item.source))];
    const dates = [...new Set(mistakesList.map(item => item.date))];
    const letters = [...new Set(mistakesList.map(item => item.word.charAt(0).toUpperCase()))].sort();

    updateSelectOptions('mistakes-sourceFilter', sources);
    updateSelectOptions('mistakes-dateFilter', dates);
    updateSelectOptions('mistakes-letterFilter', letters);
}

// 通用的筛选选项更新函数
function updateFilterOptionsForElement(sourceId, dateId, letterId) {
    const sources = [...new Set(wordList.map(item => item.source))];
    const dates = [...new Set(wordList.map(item => item.date))];
    const letters = [...new Set(wordList.map(item => item.word.charAt(0).toUpperCase()))].sort();

    updateSelectOptions(sourceId, sources);
    updateSelectOptions(dateId, dates);
    updateSelectOptions(letterId, letters);
}

// 更新选择框选项
function updateSelectOptions(selectId, options) {
    const select = document.getElementById(selectId);
    const defaultOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(defaultOption);
    options.forEach(option => {
        if (option) { // 只添加非空选项
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            select.appendChild(opt);
        }
    });
}

// 筛选词库
function filterWordBank() {
    const source = document.getElementById('wordbank-sourceFilter').value;
    const date = document.getElementById('wordbank-dateFilter').value;
    const letter = document.getElementById('wordbank-letterFilter').value;

    const filteredWords = wordList.filter(word => {
        const sourceMatch = !source || word.source === source;
        const dateMatch = !date || word.date === date;
        const letterMatch = !letter || (word.word && word.word.charAt(0).toUpperCase() === letter);
        return sourceMatch && dateMatch && letterMatch;
    });

    updateWordBankTable(filteredWords);
}

// 筛选错题本
function filterMistakes() {
    const source = document.getElementById('mistakes-sourceFilter').value;
    const date = document.getElementById('mistakes-dateFilter').value;
    const letter = document.getElementById('mistakes-letterFilter').value;

    const filteredMistakes = mistakesList.filter(word => {
        const sourceMatch = !source || word.source === source;
        const dateMatch = !date || word.date === date;
        const letterMatch = !letter || (word.word && word.word.charAt(0).toUpperCase() === letter);
        return sourceMatch && dateMatch && letterMatch;
    });

    updateMistakesTableWithData(filteredMistakes);
}

// 更新单词库表格
function updateWordBankTable(words) {
    const tbody = document.querySelector('#wordbank-table tbody');
    tbody.innerHTML = '';
    
    words.forEach(word => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${word.word}</td>
            <td>${word.meaning}</td>
            <td>${word.note || ''}</td>
            <td>${word.source}</td>
            <td>${word.date}</td>
        `;
        tbody.appendChild(row);
    });
}

// 更新错题本表格
function updateMistakesTableWithData(mistakes) {
    const tbody = document.querySelector('#mistakes-table tbody');
    tbody.innerHTML = '';
    
    mistakes.forEach(word => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${word.word}</td>
            <td>${word.meaning}</td>
            <td>${word.note || ''}</td>
            <td>${word.source}</td>
            <td>${word.date}</td>
            <td>${word.count || 1}</td>
            <td>
                <button onclick="removeFromMistakes('${word.word}')">移除</button>
                <button onclick="reviewMistake('${word.word}')">复习</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// 添加单词本地存储相关函数
function saveWordsToStorage(words) {
    try {
        localStorage.setItem('wordList', JSON.stringify(words));
    } catch (error) {
        console.error('保存单词列表时出错:', error);
        alert('保存单词列表失败，可能是存储空间不足');
    }
}

function loadWordsFromStorage() {
    try {
        const saved = localStorage.getItem('wordList');
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error('加载单词列表时出错:', error);
        return [];
    }
}

// 添加显示完成信息的函数
function showCompletionMessage() {
    const wordCard = document.getElementById('word-card');
    wordCard.innerHTML = `
        <div class="completion-message">
            <h2>复习完成！</h2>
            <p>本次共复习了 ${filteredWords.length} 个单词</p>
            <button onclick="showFilterAndStart()">重新开始</button>
            <button onclick="switchPage('mistakes')">查看错题本</button>
        </div>
    `;
}

// 添加退出复习功能
function exitReview() {
    if (confirm('确定要退出复习吗？当前进度将不会保存。')) {
        document.getElementById('review-start').style.display = 'block';
        document.getElementById('filter-section').style.display = 'none';
        document.getElementById('word-card').style.display = 'none';
        // 重置进度
        currentIndex = 0;
        filteredWords = [...wordList];
    }
}

// 在HTML文件底部添加初始化调用
document.addEventListener('DOMContentLoaded', initializeApp); 