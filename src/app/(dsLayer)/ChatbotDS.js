"use-client";
import Api from "../(apiLayer)/Api";

class ChatbotDS {
  constructor() {
    this.api = new Api();
  }

  UsersGet(requestData) {
    return this.api.postAPI(requestData, '/dev/MC_User_GET')
      .then(data => {
        console.log("parsed data", data)
        return data;
      })
      .catch(error => {
        console.error('Error during User Authentication API call :', error);
        throw error;
      });
  }

}

export default ChatbotDS; ;