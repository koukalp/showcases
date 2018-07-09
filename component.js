import Ember from 'ember';
import { inject as service } from '@ember/service';
import dateUpdateMixin from 'planner/mixins/date';

/**
 * A mobile specific component for the "base" module ( = "Main" module) of the trip.
 */
export default Ember.Component.extend(dateUpdateMixin, {
  // inject services
  mobileWorkflow: service(),

  /**
   * Helper function which creates a "PriceInfo" structure from the passed in parameters
   * @param {Int} amount - numeric amount of the price
   * @param {String} currency - currency to use
   *
   * @return {PriceInfo} price info structure that can be used with our price-display related components
   */
  priceInfo(amount, currency) {
    const sign = amount >= 0 ? '+' : '-';

    return {
      amount: amount,
      currency: currency,
      currencyValueString: `${currency} ${amount}`,
      signedCurrencyValueString: `${sign}${currency} ${amount}`
    };
  },

  /**
   * gets all the available hotel star categories. Server doesn't send the list of available hotel categories, but all the available combinations.
   * Therefore the client needs to reduce the list of "offers" (double in 2*, single in 2*, double in 3*, single in 3*, ...) and retrieve
   * only the available hotel star category
   */
  availableHotelCategories: Ember.computed('transitActivity.currentOffer.roomCategoriesPerRoom', function() {
    const hotelCategories = this.get('transitActivity.currentOffer.roomCategoriesPerRoom').map(roomCategories => {
      // each group has a single hotel star category => we can safely use the first available room type and read the category from there
      const slotCategoryRefId = roomCategories.get('firstObject').refId;
      const alternativeRooms = this.alternativeRoomsInHotelCategory(slotCategoryRefId);

      const totalSalesPrice = alternativeRooms.map(room => room.salesPrice).reduce((total, price) => total + price.amount, 0);
      const totalUnitSalesPrice = alternativeRooms.map(room => room.unitSalesPrice).reduce((total, price) => total + price.amount, 0);
      const totalDiffSalesPrice = alternativeRooms.map(room => room.diffSalesPrice).reduce((total, price) => total + price.amount, 0);
      const totalDiffUnitSalesPrice = alternativeRooms.map(room => room.diffUnitSalesPrice).reduce((total, price) => total + price.amount, 0);

      // all the prices that come from the server use the same currency => we can safely read it from the first available room
      const currency = alternativeRooms.get('firstObject').salesPrice.currency;

      const priceInfo = {
        diffSalesPrice: this.priceInfo(totalDiffSalesPrice, currency),
        diffUnitSalesPrice: this.priceInfo(totalDiffUnitSalesPrice, currency),
        salesPrice: this.priceInfo(totalSalesPrice, currency),
        unitSalesPrice: this.priceInfo(totalUnitSalesPrice, currency)
      };

      return {
        // the attribute "name" carries the name of the hotel star category. Naming was kept for consistency reasons
        name: roomCategories.get('firstObject').name,
        refId: slotCategoryRefId,
        priceInfo: priceInfo
      };
    });

    return hotelCategories;
  }),

  /**
   * simply computes which hotel category is currently selected
   */
  selectedHotelCategoryRefId: Ember.computed('module', function() {
    // the structure comes like this from the server, but the client can stay hardcoded and point to the first component of the first object in the return connections
    // this is safe since we know we display content for the "base" module and the data needs to be organized like this.
    const selectedServiceCategory = this.get('module.returnConnections.firstObject.components.firstObject.product.serviceCategory.slotCategoryRefId');

    return selectedServiceCategory;
  }),

  /**
   * same as `selectedHotelCategoryRefId`, but gets the accommodation coordinates
   */
  selectedRoomsCoordinates: Ember.computed('module', function() {
    const selectedRoomCategoryCoordinates = this.get('module.returnConnections.firstObject.components').map(
      component => component.product.serviceCategory.slotCategoryCoordinate
    );

    return selectedRoomCategoryCoordinates;
  }),

  /**
   * Client cannot simply ask the server to switch the rooms to a different (hotel star) category, but it has to
   * figure out which exact rooms should be requested. It is known that each hotel category always offers the same room types (single, double, ...),
   * the client only needs to figure out the ids (and relevant data).
   *
   * @param {String} slotCategoryRefId - id of the required hotel category
   *
   * @return {[SlotCategoryCO]} - returns a list of the rooms that should be requested.
   */
  alternativeRoomsInHotelCategory(slotCategoryRefId) {
    // all available room categories of the passed in hotel category
    const availableRoomCategories = this.get('transitActivity.currentOffer.roomCategoriesPerRoom').find(
      roomCategories => roomCategories.get('firstObject').refId === slotCategoryRefId
    );

    // coordinates of all rooms that are currently selected
    const selectedRoomsCoordinates = this.get('selectedRoomsCoordinates');

    // finds the same room types (that are selected using `selectedRoomsCoordinates`) in `availableRoomCategories`
    const newSelectedRooms = selectedRoomsCoordinates.map(selectedRoomCoordinates => {
      const relevantRoom = availableRoomCategories.find(category => {
        // use match on all the important attributes, since the coordinate doesn't have an unique id that could be used
        return (
          category.coordinate.roomType === selectedRoomCoordinates.roomType &&
          category.coordinate.max === selectedRoomCoordinates.maxOccupancy &&
          category.coordinate.min === selectedRoomCoordinates.minOccupancy &&
          category.coordinate.numAdults === selectedRoomCoordinates.numAdults &&
          category.coordinate.occupancy === selectedRoomCoordinates.occupancy
        );
      });

      return relevantRoom;
    });

    return newSelectedRooms;
  },

  actions: {
    /**
     * Manages switching hotel category - a hotel category id is passed in. The handler organises retrieving the
     * relevant room categories and requests them from the API.
     *
     * @param {String} slotCategoryRefId
     */
    chooseHotelCategory(slotCategoryRefId) {
      var roomsToBook = this.alternativeRoomsInHotelCategory(slotCategoryRefId);

      // TODO: call API and update the rooms with the new refIds
      return roomsToBook;
    }
  }
});

