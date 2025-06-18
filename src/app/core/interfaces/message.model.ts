export interface Message {
  _id: string;
  sender: {
    _id: string;
    name: string;
    photoUrl: string;
  };
  receiver?: {
    _id: string;
    name: string;
    photoUrl: string;
  };
  group?: string;
  content: string;
  timestamp: Date;
}
