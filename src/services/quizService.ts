import { QuizQuestion, StudentData } from "../types";

const API_URL = "https://script.google.com/macros/s/AKfycbx4-voV9J4l8AUIkYC_f-abvVNNkUBA90a8ovowCDY7N5bEZ4eVyM1q-wFCEr7Wshgreg/exec";
const DEFAULT_GAME_ID = "SARCO_AR";

export const validateTokenAPI = async (token: string): Promise<StudentData> => {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
                action: "login",
                token: token
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error("Format respon server tidak valid (Bukan JSON)");
        }
        
        const source = data.data || data;

        if (data.status === 'error' || data.result === 'error' || source.status === 'error') {
             throw new Error(data.message || source.message || "Token tidak valid");
        }
        
        return {
            name: source.nama || source.name || "Siswa",
            token: token,
            className: source.kelas || source.className || "-",
            gameId: source.gameId || DEFAULT_GAME_ID
        };
    } catch (error: any) {
        throw new Error(error.message || "Gagal memvalidasi token");
    }
};

export const getQuestionsAPI = async (gameId: string): Promise<QuizQuestion[]> => {
    try {
        const targetGameId = gameId || DEFAULT_GAME_ID;
        const response = await fetch(`${API_URL}?action=getQuestions&game_id=${targetGameId}`);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error("Format respon server tidak valid (Bukan JSON)");
        }

        // Logika Ekstraksi Data Robust
        let rawQuestions: any[] = [];
        
        if (Array.isArray(data)) {
            rawQuestions = data;
        } else if (typeof data === 'object' && data !== null) {
            if (Array.isArray(data.questions)) rawQuestions = data.questions;
            else if (Array.isArray(data.items)) rawQuestions = data.items;
            else if (Array.isArray(data.data)) rawQuestions = data.data;
            else if (Array.isArray(data.values)) rawQuestions = data.values;
            else if (Array.isArray(data.result)) rawQuestions = data.result;
            else if (data.data && typeof data.data === 'object') {
                 const nested = data.data;
                 if (Array.isArray(nested)) rawQuestions = nested;
                 else if (Array.isArray(nested.questions)) rawQuestions = nested.questions;
                 else if (Array.isArray(nested.data)) rawQuestions = nested.data;
            }
        }

        if (rawQuestions.length === 0) {
            console.warn("API Response JSON:", data);
            throw new Error(`Tidak ada soal tersedia untuk Game ID: ${targetGameId}`);
        }

        // MAPPING LOGIC
        return rawQuestions.map((q: any, index: number) => {
            // 1. Ambil ID
            const id = q.ID_Soal || q.id || index + 1;

            // 2. Ambil Pertanyaan
            const question = q.Pertanyaan || q.pertanyaan || q.question || q.text || "Pertanyaan tidak terbaca";

            // 3. Ambil Jawaban Benar & Poin
            const correctKey = (q.Jawaban_Benar || q.jawaban_benar || q.correctAnswer || "").toString().trim().toUpperCase();
            const points = parseInt(q.Poin || q.poin || q.point || q.points || "10");

            // 4. Deteksi Format Opsi (Flat vs Array)
            let formattedOptions = [];

            if (Array.isArray(q.options)) {
                // Handle jika API mengembalikan array options
                formattedOptions = q.options.map((opt: any, i: number) => {
                    const isObj = typeof opt === 'object';
                    const optId = isObj ? (opt.id || opt.label || ["A","B","C","D"][i]) : ["A","B","C","D"][i];
                    const optText = isObj ? (opt.text || opt.value) : opt;
                    const isCorrect = isObj ? (opt.isCorrect || optId === correctKey) : (optId === correctKey);
                    
                    return {
                        id: String(optId),
                        text: String(optText),
                        isCorrect: Boolean(isCorrect)
                    };
                });
            } else {
                // Handle Flat Structure (Opsi_A, Opsi_B, dst) - Prioritas dari Spreadsheet
                const options = [
                    { key: 'A', text: q.Opsi_A || q.opsi_a },
                    { key: 'B', text: q.Opsi_B || q.opsi_b },
                    { key: 'C', text: q.Opsi_C || q.opsi_c },
                    { key: 'D', text: q.Opsi_D || q.opsi_d }
                ];

                formattedOptions = options
                    .filter(opt => opt.text && String(opt.text).trim() !== "") 
                    .map(opt => ({
                        id: opt.key,
                        text: String(opt.text),
                        isCorrect: opt.key === correctKey
                    }));
            }

            return {
                id: id,
                question: question,
                points: points,
                options: formattedOptions
            };
        });

    } catch (error: any) {
        console.error("Get Questions Error:", error);
        throw new Error(error.message || "Gagal memuat soal");
    }
};

export const submitScoreAPI = async (token: string, score: number, gameId: string): Promise<boolean> => {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
                action: "submitScore",
                token: token,
                score: score,
                game_id: gameId || DEFAULT_GAME_ID
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error("Format respon server tidak valid (Bukan JSON)");
        }

        const source = data.data || data;
        if (data.status === 'error' || data.result === 'error' || source.status === 'error') {
            throw new Error(data.message || source.message || "Gagal mengirim nilai");
        }

        return true;
    } catch (error: any) {
        throw new Error(error.message || "Gagal mengirim nilai");
    }
};
