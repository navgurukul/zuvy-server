
      
      let zoomStartDate = new Date();
      let zoomEndDate = new Date();

      console.log('Original Zoom Start Date:', zoomStartDate);
      console.log('Original Zoom End Date:', zoomEndDate);
      
      zoomStartDate.setHours(zoomStartDate.getHours() - 5);
      zoomStartDate.setMinutes(zoomStartDate.getMinutes() - 30);

      zoomEndDate.setHours(zoomEndDate.getHours() - 5);
      zoomEndDate.setMinutes(zoomEndDate.getMinutes() - 30);
      console.log(zoomEndDate < zoomStartDate);
      console.log('Zoom Start Date:', zoomStartDate);
      console.log('Zoom End Date:', zoomEndDate);