export interface StudentData {
    name: string;
    token: string;
    className: string;
    gameId: string;
}

export interface QuizOption {
    id: string;
    text: string;
    isCorrect: boolean;
}

export interface QuizQuestion {
    id: string | number;
    question: string;
    points: number;
    options: QuizOption[];
}
